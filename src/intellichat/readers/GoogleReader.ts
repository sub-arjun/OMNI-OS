import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import { ITool } from './IChatReader';

const debug = Debug('OMNI-OS:intellichat:GoogleReader');

export default class GoogleReader extends BaseReader {
  protected processChunk(chunk: string): IChatResponseMessage | null {
    try {
      // Each chunk should be a complete message
      return this.parseReply(chunk);
    } catch (error) {
      debug('Failed to process chunk:', error);
      return null;
    }
  }

  protected parseReply(chunk: string): IChatResponseMessage {
    let _chunk = chunk.trim();
    
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
    
    try {
      const data = JSON.parse(_chunk);
      
      // Handle OpenRouter format (most common when using OMNI)
      if (data.choices) {
        const firstChoice = data.choices[0];
        const delta = firstChoice.delta || {};
        
        // Extract tool calls if present
        let toolCalls = null;
        if (delta.tool_calls && delta.tool_calls.length > 0) {
          const toolCall = delta.tool_calls[0];
          toolCalls = {
            id: toolCall.id,
            name: toolCall.function?.name,
            args: toolCall.function?.arguments || '',
            index: toolCall.index || 0,
          };
        }
        
        return {
          content: delta.content || '',
          isEnd: firstChoice.finish_reason === "tool_calls" || 
                 firstChoice.finish_reason === "stop" || 
                 firstChoice.finish_reason === "STOP",
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
          toolCalls: toolCalls ? [toolCalls] : undefined,
        };
      }
      
      // Handle native Google format (when called directly)
      if (data.candidates) {
        const firstCandidate = data.candidates[0];
        const parts = firstCandidate.content?.parts || [];
        
        // Extract text content
        const textPart = parts.find((p: any) => p.text !== undefined);
        const content = textPart?.text || '';
        
        // Extract tool calls
        const functionCallPart = parts.find((p: any) => p.functionCall);
        let toolCalls = null;
        if (functionCallPart) {
          toolCalls = [{
            id: '',
            name: functionCallPart.functionCall.name,
            args: JSON.stringify(functionCallPart.functionCall.args || {}),
          }];
        }
        
        return {
          content,
          isEnd: !!firstCandidate.finishReason,
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
          toolCalls,
        };
      }
      
      // Fallback for unknown format
      return {
        content: '',
        isEnd: false,
      };
    } catch (err) {
      console.error('Error parsing JSON:', err);
      return {
        content: '',
        isEnd: false,
      };
    }
  }

  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (!respMsg.toolCalls || respMsg.toolCalls.length === 0) {
      return null;
    }
    
    const toolCall = respMsg.toolCalls[0];
    return {
      id: toolCall.id || `tool_${Date.now()}`,
      name: toolCall.name || '',
      // Note: args will be accumulated by BaseReader's parseToolArgs
    };
  }

  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    if (!respMsg.toolCalls || respMsg.toolCalls.length === 0) {
      return null;
    }
    
    const toolCall = respMsg.toolCalls[0];
    
    // Return the arguments for BaseReader to accumulate
    return {
      index: toolCall.index || 0,
      args: toolCall.args || '',
    };
  }
}
