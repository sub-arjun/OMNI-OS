export interface IMCPServer {
  key: string;
  name?: string;
  command: string;
  description?: string;
  args: string[];
  env?: Record<string, string>;
  isActive: boolean;
  homepage?: string;
}

// Basic argument types
export type MCPArgType = 'string' | 'list' | 'number' | 'object'
export type MCPEnvType = 'string' | 'number'

// Parameter type definitions
export type MCPArgParameter = {[key: string]: any}
export type MCPEnvParameter = {[key: string]: string | number}

// Parameter description interface
export interface IMCPServerParameter {
  name: string;
  type: MCPArgType | MCPEnvType;
  description: string;
}

export interface IMCPConfig {
  servers: IMCPServer[];
  updated?: number;
}
