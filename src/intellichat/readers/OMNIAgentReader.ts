import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import IChatReader, { ITool } from './IChatReader';

const debug = Debug('OMNI-OS:intellichat:OMNIAgentReader');

export default class OMNIAgentReader extends BaseReader implements IChatReader {
  // Track tool call state and arguments
  private accumulatedToolArgs: Record<string, string> = {};
  private currentToolId: string | null = null;

  /**
   * Process incoming chunks, handling both OpenRouter processing directives and Claude data
   */
  protected processChunk(chunk: string): IChatResponseMessage | null {
    try {
      // Log raw chunks for debugging
      if (chunk && chunk.trim()) {
        debug('Raw response chunk:', chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
      }

      // Skip empty chunks or [DONE] markers
      if (!chunk || chunk.trim() === '' || chunk === '[DONE]') {
        debug('Empty chunk or [DONE] marker');
        return null;
      }

      // Handle OpenRouter processing markers
      if (chunk.includes('OPENROUTER PROCESSING')) {
        debug('Skipping OpenRouter processing marker');
        return {
          content: '',
          isEnd: false,
        };
      }

      // Handle OpenRouter + Claude 3.7 Sonnet format
      return this.parseReply(chunk);
    } catch (error: any) {
      debug('Failed to process chunk:', error);
      // Return a graceful error instead of crashing
      return {
        content: '',
        isEnd: false,
        error: {
          message: error.message || 'Unknown error processing response',
          type: 'reader_error',
          code: 500
        }
      };
    }
  }

  protected parseReply(chunk: string): IChatResponseMessage {
    try {
      const data = JSON.parse(chunk);
      
      // Check for errors
      if (data.error) {
        debug('Error in response:', data.error);
        return {
          content: '',
          error: {
            message: data.error.message || 'Unknown error',
            type: data.error.type,
            code: data.error.code || 500,
          },
        };
      }
      
      // Check if this is the final message with usage information
      if (data.usage) {
        debug(`Received token usage data: ${JSON.stringify(data.usage)}`);
        return {
          content: '',
          reasoning: '',
          isEnd: true,
          toolCalls: [],
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
        };
      }
      
      if (!data.choices || data.choices.length === 0) {
        return {
          content: '',
          reasoning: '',
          isEnd: false,
          toolCalls: [],
        };
      }
      
      const choice = data.choices[0];
      
      // Multiple ways to detect end of stream with Claude via OpenRouter
      const isFinished = 
        choice.finish_reason != null || // Standard OpenAI/OpenRouter finish
        choice.native_finish_reason != null || // Native model finish reason  
        (data.object === 'chat.completion.chunk' && data.choices[0].finish_reason === 'stop') || // Claude format
        (data.object === 'chat.completion.chunk' && data.choices[0].finish_reason === 'tool_calls'); // Claude tool completion
      
      if (isFinished) {
        debug(`Stream finished with reason: ${choice.finish_reason || choice.native_finish_reason || 'unknown'}`);
      }
      
      // Extract reasoning if available
      let reasoning = '';
      if (choice.delta?.reasoning !== undefined && choice.delta?.reasoning !== null) {
        reasoning = choice.delta.reasoning;
        debug('Extracted reasoning from delta.reasoning:', reasoning.substring(0, 50));
      }
      
      // Extract content or empty string if not present
      const content = choice.delta?.content || '';
      
      // Check for tool calls
      let toolCalls = null;
      if (choice.delta?.tool_calls) {
        debug('Extracted tool_calls from delta:', JSON.stringify(choice.delta.tool_calls).substring(0, 200));
        toolCalls = choice.delta.tool_calls;
        
        // If we receive a tool call and a finish_reason=tool_calls in the same chunk,
        // this is the end of the tool call stream
        if (choice.finish_reason === 'tool_calls' || choice.native_finish_reason === 'tool_calls') {
          debug('Tool call completed with finish_reason=tool_calls');
        }
      }
      
      return {
        content,
        reasoning,
        isEnd: isFinished,
        toolCalls,
      };
    } catch (error: any) {
      debug('Failed to parse JSON chunk:', error, 'Chunk:', chunk);
      // Return a default response instead of crashing
      return {
        content: '',
        reasoning: '',
        isEnd: false,
        error: {
          message: `Failed to parse response: ${error.message || 'Invalid JSON'}`,
          type: 'parse_error',
          code: 400
        }
      };
    }
  }

  /**
   * Extract a properly formatted tool from the response message
   */
  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (!respMsg.toolCalls || respMsg.toolCalls.length === 0) {
      return null;
    }
    
    const toolCall = respMsg.toolCalls[0];
    
    // Initialize a new tool call
    if (toolCall.id && toolCall.function?.name) {
      this.currentToolId = toolCall.id;
      debug(`New tool call detected: ${toolCall.function.name} (${toolCall.id})`);
      
      return {
        id: toolCall.id,
        name: toolCall.function.name,
        args: {},  // Arguments will be populated as we receive them
      };
    }
    
    // No valid tool found
    return null;
  }

  /**
   * Extract tool arguments from the response message
   */
  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    if (!respMsg.toolCalls || respMsg.toolCalls.length === 0) {
      return null;
    }
    
    try {
      const toolCall = respMsg.toolCalls[0];
      
      // Track the tool ID if not already set
      if (toolCall.id && !this.currentToolId) {
        this.currentToolId = toolCall.id;
      }
      
      // Extract arguments
      if (toolCall.function?.arguments) {
        debug(`Received tool arguments chunk: ${toolCall.function.arguments.substring(0, 50)}`);
        
        // Store arguments in accumulated args map for potential reuse
        if (this.currentToolId) {
          if (!this.accumulatedToolArgs[this.currentToolId]) {
            this.accumulatedToolArgs[this.currentToolId] = '';
          }
          this.accumulatedToolArgs[this.currentToolId] += toolCall.function.arguments;
        }
        
        return {
          index: toolCall.index || 0,
          args: toolCall.function.arguments,
        };
      }
    } catch (err) {
      console.error('Error parsing tool arguments:', err);
    }
    
    return null;
  }
} 