import path from 'path';
import fs from 'node:fs';
import { app } from 'electron';
import * as logging from './logging';
import { IMCPConfig, IMCPServer } from 'types/mcp';
import { isUndefined, omitBy } from 'lodash';

export const DEFAULT_INHERITED_ENV_VARS =
  process.platform === 'win32'
    ? [
        'APPDATA',
        'HOMEDRIVE',
        'HOMEPATH',
        'LOCALAPPDATA',
        'PATH',
        'PROCESSOR_ARCHITECTURE',
        'SYSTEMDRIVE',
        'SYSTEMROOT',
        'TEMP',
        'USERNAME',
        'USERPROFILE',
      ]
    : /* list inspired by the default env inheritance of sudo */
      ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER'];
/**
 * Returns a default environment object including only environment variables deemed safe to inherit.
 */
export function getDefaultEnvironment() {
  const env: Record<string, string> = {};
  DEFAULT_INHERITED_ENV_VARS.forEach((key) => {
    const value = process.env[key];
    if (value === undefined) {
      return;
    }
    if (value.startsWith('()')) {
      // Skip functions, which are a security risk.
      return;
    }
    env[key] = value;
  });
  return env;
}

export default class ModuleContext {
  private clients: { [key: string]: any } = {};

  private Client: any;

  private Transport: any;

  private cfgPath: string;

  constructor() {
    this.cfgPath = path.join(app.getPath('userData'), 'mcp.json');
  }

  public async init() {
    this.Client = await this.importClient();
    this.Transport = await this.importTransport();
  }

  private async importClient() {
    const { Client } = await import(
      '@modelcontextprotocol/sdk/client/index.js'
    );
    return Client;
  }

  private async importTransport() {
    const { StdioClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/stdio.js'
    );
    return StdioClientTransport;
  }

  private getMCPServer(server: IMCPServer, config: IMCPConfig) {
    let mcpSvr = config.servers.find(
      (svr: IMCPServer) => svr.key === server.key,
    );
    mcpSvr = Object.assign(
      {},
      mcpSvr,
      omitBy({ ...server, isActive: true }, isUndefined),
    );
    logging.debug('MCP Server:', mcpSvr);
    return mcpSvr;
  }

  private async updateConfigAfterActivation(
    server: IMCPServer,
    config: IMCPConfig,
  ) {
    const index = config.servers.findIndex(
      (svr: IMCPServer) => svr.key === server.key,
    );
    if (index > -1) {
      config.servers[index] = server;
    } else {
      config.servers.push(server);
    }
    await this.putConfig(config);
  }

  private async updateConfigAfterDeactivation(key: string, config: IMCPConfig) {
    config.servers = config.servers.map((svr: IMCPServer) => {
      if (svr.key === key) {
        svr.isActive = false;
      }
      return svr;
    });
    await this.putConfig(config);
  }

  public async getConfig() {
    const defaultConfig = { servers: [] };
    try {
      if (!fs.existsSync(this.cfgPath)) {
        fs.writeFileSync(this.cfgPath, JSON.stringify(defaultConfig, null, 2));
      }
      const config = JSON.parse(fs.readFileSync(this.cfgPath, 'utf-8'));
      if (!config.servers) {
        config.servers = [];
      }
      return config;
    } catch (err: any) {
      logging.captureException(err);
      return defaultConfig;
    }
  }

  public async putConfig(config: any) {
    try {
      fs.writeFileSync(this.cfgPath, JSON.stringify(config, null, 2));
      return true;
    } catch (err: any) {
      logging.captureException(err);
      return false;
    }
  }

  public async load() {
    const { servers } = await this.getConfig();
    for (const server of servers) {
      if (server.isActive) {
        logging.debug('Activating server:', server.key);
        const { error } = await this.activate(server);
        if (error) {
          logging.error('Failed to activate server:', server.key, error);
        }
      }
    }
  }

  public async addServer(server: IMCPServer) {
    const config = await this.getConfig();
    const originalKey = server.key;
    
    // Check if this key already has an instance number
    const isAlreadyNumbered = originalKey.includes('-') && 
                             !isNaN(Number(originalKey.split('-').pop()));
    
    // Get base key without instance number if it exists
    const baseKey = isAlreadyNumbered ? originalKey.split('-').slice(0, -1).join('-') : originalKey;
    
    // Find all instances of this server (original and duplicates)
    const existingInstances = config.servers.filter((svr: IMCPServer) => {
      // Match exact key or key-number pattern
      return svr.key === baseKey || 
             (svr.key.startsWith(baseKey + '-') && !isNaN(Number(svr.key.split('-').pop())));
    });
    
    if (existingInstances.length > 0) {
      // Find the highest instance number
      let highestInstance = 0;
      existingInstances.forEach((svr: IMCPServer) => {
        if (svr.key.includes('-')) {
          const instanceNum = Number(svr.key.split('-').pop());
          if (!isNaN(instanceNum) && instanceNum > highestInstance) {
            highestInstance = instanceNum;
          }
        }
      });
      
      // Create new key with next instance number
      const newInstance = highestInstance + 1;
      const newKey = `${baseKey}-${newInstance}`;
      server.key = newKey;
      
      // Update name to include instance number
      if (server.name) {
        // First check if the original name already has a number in parentheses at the end
        // This handles cases where marketplace servers might already have (2) etc. in their names
        let baseName = server.name;
        
        // Remove any existing number in parentheses at the end of the name
        baseName = baseName.replace(/\s*\(\d+\)\s*$/, '');
        
        // Set the name with the new instance number + 1 (for human-friendly numbering)
        // The first duplicate should be labeled as (2), second as (3), etc.
        server.name = `${baseName} (${newInstance + 1})`;
      }
    }
    
    // Add the server to the config
    config.servers.push(server);
    await this.putConfig(config);
    return true;
  }

  public async updateServer(server: IMCPServer) {
    console.log('updateServer', JSON.stringify(server));
    const config = await this.getConfig();
    const index = config.servers.findIndex(
      (svr: IMCPServer) => svr.key === server.key,
    );
    if (index > -1) {
      config.servers[index] =server;
      await this.putConfig(config);
      return true;
    }
    return false;
  }

  public async activate(server: IMCPServer): Promise<{ error: any }> {
    try {
      const config = await this.getConfig();
      let mcpSvr = this.getMCPServer(server, config);
      const { key, command, args, env } = mcpSvr;
      let cmd: string = command;
      if (command === 'npx') {
        cmd = process.platform === 'win32' ? `${command}.cmd` : command;
      }
      const mergedEnv = {
        ...getDefaultEnvironment(),
        ...env,
        PATH: process.env.PATH,
      };
      const client = new this.Client(
        {
          name: key,
          version: '1.0.0',
        },
        {
          capabilities: {},
        },
      );
      const transport = new this.Transport({
        command: cmd,
        args,
        stderr: process.platform === 'win32' ? 'pipe' : 'inherit',
        env: mergedEnv,
      });
      await client.connect(transport);
      this.clients[key] = client;
      await this.updateConfigAfterActivation(mcpSvr, config);
      return { error: null };
    } catch (error: any) {
      logging.captureException(error);
      this.deactivate(server.key);
      return { error };
    }
  }

  public async deactivate(key: string) {
    try {
      if (this.clients[key]) {
        await this.clients[key].close();
        delete this.clients[key];
      }
      await this.updateConfigAfterDeactivation(key, await this.getConfig());
      return { error: null };
    } catch (error: any) {
      logging.captureException(error);
      return { error };
    }
  }

  public async close() {
    for (const key in this.clients) {
      logging.info(`Closing MCP Client ${key}`);
      await this.clients[key].close();
      delete this.clients[key];
    }
  }

  public async listTools(key?: string) {
    let allTools: any = [];
    if (key) {
      if (!this.clients[key]) {
        throw new Error(`MCP Client ${key} not found`);
      }
      const config = await this.getConfig();
      const server = config.servers.find((svr: IMCPServer) => svr.key === key);
      const serverName = server?.name || key;
      const { tools } = await this.clients[key].listTools();
      allTools = tools.map((tool: any) => {
        // Keep the original tool name format for compatibility
        tool.name = `${key}--${tool.name}`;
        // Store server information separately
        tool._serverName = serverName;
        tool._clientKey = key;
        return tool;
      });
    } else {
      const config = await this.getConfig();
      for (const clientKey in this.clients) {
        const server = config.servers.find((svr: IMCPServer) => svr.key === clientKey);
        const serverName = server?.name || clientKey;
        const { tools } = await this.clients[clientKey].listTools();
        allTools = allTools.concat(
          tools.map((tool: any) => {
            // Keep the original tool name format for compatibility
            tool.name = `${clientKey}--${tool.name}`;
            // Store server information separately
            tool._serverName = serverName;
            tool._clientKey = clientKey;
            return tool;
          }),
        );
      }
    }
    return allTools;
  }

  public async callTool({
    client,
    name,
    args,
  }: {
    client: string;
    name: string;
    args: any;
  }) {
    try {
      if (!name) {
        return {
          isError: true,
          content: [{ error: "Tool name is required. Please try again with a valid tool name." }]
        };
      }
      
      // Simple parsing of the tool name
      const parts = name.split('--');
      const toolName = parts.length > 1 ? parts[1] : name;
      const clientKey = client || (parts.length > 1 ? parts[0] : '');
      
      if (!clientKey) {
        return {
          isError: true,
          content: [{ error: "Client key is required. Please try again with a valid client identifier." }]
        };
      }

      if (!this.clients[clientKey]) {
        return {
          isError: true,
          content: [{ error: `Client '${clientKey}' not found. Available clients: ${Object.keys(this.clients).join(', ')}` }]
        };
      }
      
      // Identify the model family for logging purposes
      const isOpenAI = clientKey.toLowerCase().includes('openai') || name.toLowerCase().includes('openai');
      const isGrok = clientKey.toLowerCase().includes('grok') || clientKey.toLowerCase().includes('x-ai');
      const isAnthropicClaude = clientKey.toLowerCase().includes('anthropic') || name.toLowerCase().includes('claude');
      const isGemini = clientKey.toLowerCase().includes('google') || clientKey.toLowerCase().includes('gemini');
      
      // Log tool call details
      logging.debug(`Tool call: ${clientKey}/${toolName}`, {
        modelFamily: isOpenAI ? 'OpenAI' : isGrok ? 'Grok' : isAnthropicClaude ? 'Claude' : isGemini ? 'Gemini' : 'Other',
        argsType: typeof args
      });
      
      // Prepare arguments - keep it simple
      let toolArgs = args;
      
      // Handle string-based arguments that might be partial JSON
      if (typeof toolArgs === 'string') {
        const trimmedArgs = toolArgs.trim();
        
        // Handle complete and partial JSON
        if (trimmedArgs.startsWith('{') && trimmedArgs.endsWith('}')) {
          try {
            // Complete JSON object
            toolArgs = JSON.parse(trimmedArgs);
            logging.debug('Parsed complete JSON string arguments');
          } catch (e) {
            // Malformed JSON, but looks like a search query
            if (toolName.toLowerCase().includes('search')) {
              logging.debug('Using malformed JSON as search query');
              toolArgs = { query: trimmedArgs };
            }
          }
        } 
        // Handle partial JSON with query keywords (common in streaming responses)
        else if (trimmedArgs.includes('query') || trimmedArgs.includes('quer')) {
          logging.debug('Found partial query in string arguments');
          toolArgs = { query: trimmedArgs };
        }
        // General string for search tools
        else if (toolName.toLowerCase().includes('search')) {
          logging.debug('Using string directly as search query');
          toolArgs = { query: trimmedArgs };
        }
      }
      
      // Handle completely empty arguments case
      if (toolArgs === null || toolArgs === undefined) {
        toolArgs = {};
      }
      
      // Ensure we have an object
      if (typeof toolArgs !== 'object') {
        toolArgs = { query: String(toolArgs) };
      }
      
      // For search tools, require a valid query from the model
      if (toolName.toLowerCase().includes('search') && 
          (!toolArgs.query || toolArgs.query === "")) {
        
        logging.debug('Missing search query from model');
        return {
          isError: true,
          content: [{
            error: "Search tools require a query parameter. Please provide a specific search query.",
            suggestion: "Try again with a detailed search query instead of an empty search."
          }]
        };
      }
      
      // Log final arguments being sent
      logging.debug('Final processed tool args:', toolArgs);
      
      // Call the tool
      try {
        const result = await this.clients[clientKey].callTool({
          name: toolName,
          arguments: toolArgs
        });
        return result;
      } catch (toolError: any) {
        // Create a meaningful error message for the model to understand and retry
        logging.error(`Error calling ${clientKey} tool ${toolName}:`, toolError);
        return {
          isError: true,
          content: [{
            error: `Error calling ${toolName}: ${toolError.message || 'Unknown error'}. Please try again with valid parameters.`,
            details: String(toolError)
          }]
        };
      }
    } catch (error: any) {
      // Format error for the model to understand
      logging.error('Error in MCP callTool:', error);
      return {
        isError: true,
        content: [{ 
          error: `Failed to process tool call: ${error.message || 'Unknown error'}. Please try again.`,
          details: String(error)
        }]
      };
    }
  }

  public getClient(name: string) {
    return this.clients[name];
  }

  public getClientNames() {
    return Object.keys(this.clients);
  }
}
