import path from 'path';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
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

  public async getConfig(): Promise<IMCPConfig> {
    const defaultConfig: IMCPConfig = { servers: [] };
    try {
      try {
        const configData = await fsPromises.readFile(this.cfgPath, 'utf-8');
        const config = JSON.parse(configData);
        if (!config.servers) {
          config.servers = [];
        }
        return config;
      } catch (readError: any) {
        if (readError.code === 'ENOENT') {
          await fsPromises.writeFile(this.cfgPath, JSON.stringify(defaultConfig, null, 2));
          return defaultConfig;
        } else {
          throw readError;
        }
      }
    } catch (err: any) {
      logging.captureException(err);
      return defaultConfig;
    }
  }

  public async putConfig(config: IMCPConfig): Promise<boolean> {
    try {
      await fsPromises.writeFile(this.cfgPath, JSON.stringify(config, null, 2));
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
      // --- Basic Validation ---
      if (!name) {
        logging.warn('Tool call rejected: Missing tool name.');
        return {
          isError: true,
          content: [{ error: "Tool call failed: Tool name is required. Please specify a valid tool name." }]
        };
      }
      
      const parts = name.split('--');
      const toolName = parts.length > 1 ? parts[1] : name;
      const clientKey = client || (parts.length > 1 ? parts[0] : '');
      
      if (!clientKey) {
         logging.warn(`Tool call rejected for '${toolName}': Missing client key.`);
        return {
          isError: true,
          content: [{ error: `Tool call failed for '${toolName}': Client key is required. Please specify the client.` }]
        };
      }

      if (!this.clients[clientKey]) {
        logging.warn(`Tool call rejected: Client '${clientKey}' not found.`);
        return {
          isError: true,
          content: [{ error: `Tool call failed: Client '${clientKey}' not found. Available clients: ${Object.keys(this.clients).join(', ')}. Please use a valid client.` }]
        };
      }
      
      logging.debug(`Processing tool call: ${clientKey}/${toolName}`, { argsType: typeof args, rawArgs: args });
      
      // --- Argument Processing (Simplified) ---
      let toolArgs: Record<string, any> | null = null;

      if (typeof args === 'object' && args !== null) {
        // Already a valid object
        toolArgs = args;
        logging.debug('Using provided object arguments:', toolArgs);
      } else if (typeof args === 'string') {
        // Attempt to parse JSON string
        try {
          toolArgs = JSON.parse(args);
          logging.debug('Parsed JSON string arguments:', toolArgs);
        } catch (e: any) {
          // Invalid JSON string
          logging.warn(`Failed to parse arguments string as JSON for tool '${toolName}'. Error: ${e.message}`, { argsString: args });
          return {
            isError: true,
            content: [{
              error: `Invalid tool arguments format for '${toolName}'. Expected a valid JSON object string, but received a string that could not be parsed. Please provide arguments as a valid JSON object string.`,
              received_args: args,
              parsing_error: e.message
            }]
          };
      }
      } else {
         // Arguments are neither object nor string (null, undefined, number, etc.) -> Invalid
         logging.warn(`Invalid arguments type received for tool '${toolName}': ${typeof args}. Expected object or JSON string.`);
        return {
          isError: true,
          content: [{
              error: `Invalid tool arguments format for '${toolName}'. Expected arguments as a JSON object or a valid JSON string.`,
              received_type: typeof args,
              received_value: args // Show the model what was received
          }]
        };
      }
      
      // --- Tool Execution ---
      logging.debug(`Calling tool '${toolName}' on client '${clientKey}' with arguments:`, toolArgs);
      
      try {
        const result = await this.clients[clientKey].callTool({
          name: toolName,
          arguments: toolArgs // Pass the validated/parsed object
        });
        logging.debug(`Tool '${toolName}' executed successfully.`);
        return result;
      } catch (toolError: any) {
        // Error during actual tool execution
        logging.error(`Error executing tool '${toolName}' on client '${clientKey}':`, toolError);
        return {
          isError: true,
          content: [{
            error: `Tool execution failed for '${toolName}': ${toolError.message || 'Unknown error'}. Please review the tool's requirements and correct the arguments or tool usage.`,
            tool_name: toolName,
            client_key: clientKey,
            provided_args: toolArgs,
            details: String(toolError)
          }]
        };
      }
    } catch (error: any) {
      // General error during processing before tool execution attempt
      logging.error('Error processing tool call request:', error);
      return {
        isError: true,
        content: [{ 
          error: `Failed to process tool call request: ${error.message || 'Unknown error'}. Please check the tool name and arguments format and try again.`,
          original_tool_name_param: name,
          original_args_param: args,
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
