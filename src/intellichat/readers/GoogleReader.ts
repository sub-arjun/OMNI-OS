import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import { extractFirstLevelBrackets } from 'utils/util';
import { IReadResult, ITool } from './IChatReader';

const debug = Debug('OMNI-OS:intellichat:GoogleReader');

export default class GoogleReader extends BaseReader {
  // Track accumulated tool call arguments for streaming responses
  private accumulatedToolArgs: Record<string, string> = {};

  // Add a cleanup method to properly release resources
  public cleanup(): void {
    // Clear accumulated tool arguments to prevent memory leaks
    this.accumulatedToolArgs = {};
    debug('GoogleReader resources cleaned up');
  }

  protected parseReply(chunk: string): IChatResponseMessage {
    let _chunk = chunk.trim();
    try {
      // Handle SSE (Server-Sent Events) format from OpenRouter
      if (_chunk.startsWith('data: ')) {
        _chunk = _chunk.substring(6).trim();
      }
      
      // Skip empty chunks or [DONE] markers
      if (!_chunk || _chunk === '[DONE]') {
        return {
          content: '',
          isEnd: _chunk === '[DONE]',
        };
      }
      
      const data = JSON.parse(_chunk);
      
      // Handle OpenRouter format for all model types
      if (data.choices) {
        debug('Parsing OpenRouter response');
        const firstChoice = data.choices[0];
        const provider = data.provider || '';
        const model = data.model || '';
        
        debug(`Provider: ${provider}, Model: ${model}`);
        
        // Extract tool calls from OpenRouter format if present
        let toolCalls = null;
        
        if (firstChoice.delta && firstChoice.delta.tool_calls && firstChoice.delta.tool_calls.length > 0) {
          const firstToolCall = firstChoice.delta.tool_calls[0];
          debug('Found OpenRouter tool call:', firstToolCall);
          
          const toolId = firstToolCall.id || `tool_${Date.now()}`;
          const toolName = firstToolCall.function?.name || '';
          
          // Handle tool calls that come in chunks (common in streaming responses)
          if (firstToolCall.function?.arguments !== undefined) {
            // Accumulate arguments if they're being streamed in chunks
            if (!this.accumulatedToolArgs[toolId]) {
              this.accumulatedToolArgs[toolId] = '';
            }
            
            this.accumulatedToolArgs[toolId] += firstToolCall.function.arguments;
            debug(`Accumulated args for ${toolId}:`, this.accumulatedToolArgs[toolId]);
          }
          
          // Build the tool call object with accumulated arguments
          toolCalls = {
            id: toolId,
            name: toolName,
            // Store arguments for parsing
            args: this.accumulatedToolArgs[toolId] || firstToolCall.function?.arguments || '',
            // Store the raw function object to handle different formats
            function: {
              ...firstToolCall.function,
              // Use accumulated arguments if available
              arguments: this.accumulatedToolArgs[toolId] || firstToolCall.function?.arguments || ''
            },
            // Store the raw tool call for complex parsing
            rawToolCall: firstToolCall
          };
        }
        
        return {
          content: firstChoice.delta?.content || '',
          isEnd: firstChoice.finish_reason === "tool_calls" || 
                 firstChoice.finish_reason === "stop" || 
                 firstChoice.native_finish_reason === "STOP",
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          toolCalls: toolCalls
        };
      }
      // Original Google format parsing
      else if (data.candidates) {
        const firstCandidate = data.candidates[0];
        return {
          content: firstCandidate.content.parts[0].text || '',
          isEnd: firstCandidate.finishReason,
          inputTokens: data.usageMetadata.promptTokenCount,
          outputTokens: data.usageMetadata.candidatesTokenCount,
          toolCalls: firstCandidate.content.parts[0].functionCall,
        };
      } else {
        return {
          content: '',
          isEnd: false,
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
        };
      }
    } catch (err) {
      console.error('Error parsing JSON:', err);
      // Log the problematic chunk for debugging
      if (_chunk.length < 200) {
        console.error('Problematic chunk:', _chunk);
      } else {
        console.error('Problematic chunk (truncated):', _chunk.substring(0, 200) + '...');
      }
      return {
        content: '',
        isEnd: false,
      };
    }
  }

  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (!respMsg.toolCalls) {
      return null;
    }
    
    // Log the raw tool call for debugging
    debug('Tool call detected:', JSON.stringify(respMsg.toolCalls, null, 2));
    
    // Extract tool name - handle different formats
    let toolName = '';
    if (respMsg.toolCalls.name) {
      // Direct name property (standard format)
      toolName = respMsg.toolCalls.name;
    } else if (respMsg.toolCalls.function && respMsg.toolCalls.function.name) {
      // OpenRouter format name in function object
      toolName = respMsg.toolCalls.function.name;
    } else if (respMsg.toolCalls.rawToolCall && respMsg.toolCalls.rawToolCall.function) {
      // Fallback to rawToolCall for OpenRouter format
      toolName = respMsg.toolCalls.rawToolCall.function.name;
    }
    
    if (!toolName) {
      debug('No tool name found in tool call');
      return null;
    }
    
    // Check if this is a search tool
    const isSearchTool = toolName.toLowerCase().includes('search') || 
                         toolName.toLowerCase().includes('tavily');
    
    // Simple approach to extract arguments - minimize transformations
    let args: any = null;
    
    // Handle different formats of arguments storage
    if (respMsg.toolCalls.args) {
      // Direct args property (might be accumulated string from streaming)
      args = respMsg.toolCalls.args;
    } else if (respMsg.toolCalls.function && respMsg.toolCalls.function.arguments) {
      // OpenRouter format - arguments in function object (common for all models)
      const argsStr = respMsg.toolCalls.function.arguments;
      if (argsStr) {
        try {
          // If arguments look like JSON, parse them
          if (typeof argsStr === 'string' && 
             (argsStr.trim().startsWith('{') || argsStr.trim().startsWith('['))) {
            args = JSON.parse(argsStr);
            debug('Parsed tool arguments from JSON string:', args);
          } else {
            // Otherwise keep as is (might be a partial JSON string)
            args = argsStr;
            debug('Using arguments as raw value:', args);
          }
        } catch (e) {
          debug('Failed to parse arguments string:', argsStr);
          
          // Check if this looks like a partial JSON string
          if (typeof argsStr === 'string' && 
              (argsStr.includes('query') || argsStr.includes('quer'))) {
            debug('Found partial query in arguments, using as is');
            args = { query: argsStr };
          } else {
            args = { query: argsStr };
          }
        }
      }
    } else if (respMsg.toolCalls.arguments) {
      // Alternative format
      args = respMsg.toolCalls.arguments;
    } else if (respMsg.toolCalls.rawToolCall && respMsg.toolCalls.rawToolCall.function) {
      // Extract from raw tool call as last resort
      const rawFunction = respMsg.toolCalls.rawToolCall.function;
      try {
        const rawArgs = rawFunction.arguments || '';
        if (typeof rawArgs === 'string' && 
           (rawArgs.trim().startsWith('{') || rawArgs.trim().startsWith('['))) {
          args = JSON.parse(rawArgs);
        } else {
          args = rawArgs;
        }
      } catch (e) {
        args = { query: rawFunction.arguments || '' };
      }
    } else if (respMsg.toolCalls.input) {
      // For plain text input
      args = respMsg.toolCalls.input;
    } else if (respMsg.toolCalls.content) {
      // Fallback to content
      args = respMsg.toolCalls.content;
    }
    
    // Parse string arguments to objects if possible
    if (typeof args === 'string') {
      // Handle completed JSON strings
      if (args.trim().startsWith('{') && args.trim().endsWith('}')) {
        try {
          args = JSON.parse(args);
        } catch (e) {
          // If parsing fails and it's a search tool, wrap in query
          if (isSearchTool) {
            args = { query: args };
          }
        }
      } 
      // Handle partial JSON with query keyword for search tools
      else if (isSearchTool && 
               (args.includes('query') || args.includes('quer'))) {
        args = { query: args };
      }
      // Direct string for search tools
      else if (isSearchTool) {
        args = { query: args };
      }
    }
    
    // Don't add default queries - let the MCP handle empty queries
    // This ensures the model must provide its own query
    
    // Return the tool with its extracted parameters
    debug('Extracted tool call:', { name: toolName, args });
    return {
      id: respMsg.toolCalls.id || '',
      name: toolName,
      args
    };
  }

  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    if (respMsg.toolCalls) {
      return {
        index: 0,
        args: respMsg.toolCalls.args,
      };
    }
    return null;
  }

  public async read({
    onError,
    onProgress,
    onToolCalls,
  }: {
    onError: (error: any) => void;
    onProgress: (chunk: string) => void;
    onToolCalls: (toolCalls: any) => void;
  }): Promise<IReadResult> {
    const decoder = new TextDecoder('utf-8');
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let done = false;
    let tool = null;
    
    // Reset accumulated tool args for new read
    this.accumulatedToolArgs = {};
    
    try {
      while (!done) {
        /* eslint-disable no-await-in-loop */
        const data = await this.streamReader.read();
        done = data.done || false;
        const value = decoder.decode(data.value);
        
        // Log raw response chunks for debugging
        if (value && value.trim()) {
          debug('Raw response chunk:', value.substring(0, 200) + (value.length > 200 ? '...' : ''));
        }
        
        // Handle Server-Sent Events (SSE) format from OpenRouter
        // Split by newlines to handle multiple data: lines
        const lines = value.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Skip empty lines
          if (!trimmedLine) continue;
          
          // Check if this is an SSE data line
          if (trimmedLine.startsWith('data: ')) {
            const dataContent = trimmedLine.substring(6).trim();
            
            // Skip [DONE] markers
            if (dataContent === '[DONE]') {
              done = true;
              continue;
            }
            
            // For SSE format, each data line should contain a complete JSON object
            if (dataContent.startsWith('{') && dataContent.endsWith('}')) {
              const response = this.parseReply(dataContent);
              content += response.content;
              if (response.inputTokens) {
                inputTokens = response.inputTokens;
              }
              if (response.outputTokens) {
                outputTokens += response.outputTokens;
              }
              if (response.toolCalls) {
                debug('Tool call detected in reader, raw data:', JSON.stringify(response.toolCalls).substring(0, 200));
                tool = this.parseTools(response);
                if (tool && tool.name) {
                  debug('Parsed tool with name:', tool.name, 'args:', JSON.stringify(tool.args));
                  onToolCalls(tool.name);
                }
              }
              onProgress(response.content || '');
              
              // Check if this response indicates the end
              if (response.isEnd) {
                done = true;
              }
            }
          } else if (trimmedLine.startsWith('{')) {
            // Handle non-SSE format (direct JSON)
            const items = extractFirstLevelBrackets(trimmedLine);
            for (const item of items) {
              const response = this.parseReply(item);
              content += response.content;
              if (response.inputTokens) {
                inputTokens = response.inputTokens;
              }
              if (response.outputTokens) {
                outputTokens += response.outputTokens;
              }
              if (response.toolCalls) {
                debug('Tool call detected in reader, raw data:', JSON.stringify(response.toolCalls).substring(0, 200));
                tool = this.parseTools(response);
                if (tool && tool.name) {
                  debug('Parsed tool with name:', tool.name, 'args:', JSON.stringify(tool.args));
                  onToolCalls(tool.name);
                }
              }
              onProgress(response.content || '');
            }
          }
        }
      }
    } catch (err) {
      console.error('Read error:', err);
      onError(err);
    } finally {
      // Clean up accumulated tool args to prevent memory leaks
      this.cleanup();
      
      debug('Reader finished with content length:', content.length, 'tool:', tool ? tool.name : 'none');
      return {
        content,
        tool,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
      };
    }
  }
}
