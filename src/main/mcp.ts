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
    if (!name) {
      throw new Error('Tool name is required');
    }
    
    // Extract the actual tool name from the combined string (removing server name prefix)
    const toolName = name.split('--')[1];
    
    if (!toolName) {
      throw new Error(`Invalid tool name format: ${name}. Expected format: clientKey--toolName`);
    }
    
    // Get the client key from the tool's metadata if available
    const tools = await this.listTools();
    const tool = tools.find((t: any) => t.name === name);
    const clientKey = tool?._clientKey || client;
    
    if (!clientKey) {
      throw new Error('Client key is required');
    }

    if (!this.clients[clientKey]) {
      throw new Error(`MCP Client ${clientKey} not found`);
    }
    
    logging.debug('Calling:', clientKey, toolName, args);
    
    // Get the server name from the tool metadata or config
    const serverName = tool?._serverName || clientKey;
    
    // Include the server name directly in the arguments
    const enhancedArgs = {
      ...args,
      _serverInfo: {
        name: serverName,
        key: clientKey
      }
    };
    
    // Log the enhanced arguments for debugging
    logging.debug('Enhanced arguments with server info:', enhancedArgs);
    
    const result = await this.clients[clientKey].callTool({
      name: toolName,
      arguments: enhancedArgs,
      // Context might not be used by all implementations
      context: {
        serverName: serverName,
        serverKey: clientKey
      }
    });
    return result;
  }

  public getClient(name: string) {
    return this.clients[name];
  }

  public getClientNames() {
    return Object.keys(this.clients);
  }
}
