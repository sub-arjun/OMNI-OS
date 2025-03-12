/**
 * ['--db-path',<dbPath>] => dbPath
 */

import { flatten, isUndefined } from "lodash";
import { MCPArgParameter, MCPArgType, MCPEnvParameter, MCPEnvType, IMCPServerParameter } from "types/mcp";

export function getParameters(parmas: string[]): IMCPServerParameter[] {
  const result: IMCPServerParameter[] = [];
  if (!parmas) {
    return result;
  }
  
  // Regular expression to match template parameters
  const pattern = /\{\{(?<n>[^@]+)@(?<type>[^:]+)(::(?<description>[^}]*)?)?\}\}/;
  
  parmas.forEach((param: string) => {
    // Check if this string contains a parameter template
    if (param.includes('{{') && param.includes('}}')) {
      const match = param.match(pattern);
      if (match && match.groups) {
        result.push({
          name: match.groups.n,
          type: match.groups.type as MCPEnvType|MCPArgType,
          description: match.groups.description || '',
        });
      }
    }
  });
  
  return result;
}

/**
 * Function to safely fill command arguments with parameter values
 */
export function fillArgs(
  args: string[],
  params: MCPArgParameter
): string[] {
  // Make a copy of the args array to fill with parameters
  const filledArgs: (string|string[])[] = [];
  
  // Pattern to match parameter placeholders
  const paramPattern = /\{\{([^@]+)@([^:]+)(?:::([^}]*))?\}\}/;
  
  // Process each argument
  for (const arg of args) {
    // Check if argument contains a parameter placeholder
    const match = arg.match(paramPattern);
    
    if (!match) {
      // If no match, keep the argument as is
      filledArgs.push(arg);
      continue;
    }
    
    // Extract parameter name from the match
    const paramName = match[1];
    
    // Get parameter value, with fallback to empty string
    const paramValue = params[paramName];
    
    // Handle the parameter value based on its type
    if (paramValue === undefined || paramValue === null) {
      // Use empty string for missing values
      filledArgs.push('');
    } else if (Array.isArray(paramValue)) {
      // For arrays, keep as array (will be flattened later)
      filledArgs.push(paramValue.map(item => item?.toString() || ''));
    } else if (typeof paramValue === 'object') {
      // For objects, stringify (with fallback)
      try {
        filledArgs.push(JSON.stringify(paramValue));
      } catch (error) {
        console.error('Failed to stringify object parameter:', error);
        filledArgs.push('');
      }
    } else {
      // For primitives, convert to string
      filledArgs.push(String(paramValue));
    }
  }
  
  // Flatten the result (in case there were array parameters)
  return flatten(filledArgs);
}

export function FillEnv(
  env: Record<string, string> | undefined,
  params: { [key: string]: string }
): Record<string, string> {
  if (!env) return {};
  
  // Pattern to match parameter placeholders
  const pattern = /\{\{(?<n>[^@]+)@(?<type>[^:]+)(::(?<description>[^}]*)?)?\}\}/;
  
  // Create a copy of the environment variables
  let filledEnv = {...env};
  
  // Process each environment variable
  const envKeys = Object.keys(env);
  for (const envKey of envKeys) {
    const envValue = env[envKey];
    
    // Skip if the value is not a string
    if (typeof envValue !== 'string') continue;
    
    // Check if this contains a parameter template
    if (envValue.includes('{{') && envValue.includes('}}')) {
      const match = envValue.match(pattern);
      if (match && match.groups) {
        const paramName = match.groups.n;
        // Replace with the parameter value or empty string if not found
        filledEnv[envKey] = params[paramName] || '';
      }
    }
  }
  
  return filledEnv;
}
