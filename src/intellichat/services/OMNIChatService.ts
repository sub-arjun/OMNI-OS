import Debug from 'debug';
import {
  IChatContext,
  IChatRequestMessage,
  IChatRequestPayload,
} from 'intellichat/types';

import OpenAIChatService from './OpenAIChatService';
import OMNI from 'providers/OMNI';
import useAuthStore from 'stores/useAuthStore';
import INextChatService from './INextCharService';
import { urlJoin } from 'utils/util';
import OpenAIReader from 'intellichat/readers/OpenAIReader';
import GoogleReader from 'intellichat/readers/GoogleReader';
import AnthropicReader from 'intellichat/readers/AnthropicReader';
import ChatBroReader from 'intellichat/readers/ChatBroReader';
import OllamaChatReader from 'intellichat/readers/OllamaChatReader';
import IChatReader, { ITool, IReadResult } from 'intellichat/readers/IChatReader';
import { IChatResponseMessage } from 'intellichat/types';

const debug = Debug('OMNI-OS:intellichat:OMNIChatService');

// Custom GrokReader that extends OpenAIReader but with specialized tool parsing
class GrokReader extends OpenAIReader {
  // Track if we're currently processing a tool call
  private processingToolCall = false;
  private currentToolCall: Partial<ITool> = {};
  
  protected parseReply(chunk: string): IChatResponseMessage {
    // Check if it's OpenRouter processing marker
    if (chunk.includes('OPENROUTER PROCESSING')) {
      // Just return an empty message for processing markers
      debug('Detected OpenRouter processing marker, skipping');
      return {
        content: '',
        isEnd: false
      };
    }
    
    // Check for the [DONE] marker with extra text
    if (chunk.includes('[DONE]')) {
      debug('Detected [DONE] marker, marking as end of stream');
      return {
        content: '',
        isEnd: true
      };
    }
    
    // First try standard OpenAI parsing
    try {
      // Extract the actual JSON if the chunk includes "data: " prefix
      let jsonChunk = chunk;
      if (chunk.startsWith('data:')) {
        jsonChunk = chunk.substring(5).trim();
      }
      
      // Check for empty data or just whitespace
      if (!jsonChunk || jsonChunk.trim() === '') {
        return {
          content: '',
          isEnd: false
        };
      }
      
      // Save the raw chunk for later specialized processing
      let result;
      try {
        result = super.parseReply(jsonChunk);
      } catch (e) {
        debug('Error in super.parseReply, using basic result');
        result = {
          content: '',
          isEnd: false
        };
      }
      
      (result as any).raw = jsonChunk;
      
      // Check if this chunk contains a tool call
      if (jsonChunk.includes('"tool_calls"')) {
        debug('Found tool_calls in chunk, setting processing flag');
        this.processingToolCall = true;
        
        try {
          const data = JSON.parse(jsonChunk);
          
          // Check for both formats:
          // 1. Standard OpenAI: choices[0].delta.tool_calls
          // 2. Grok via OpenRouter: choices[0].delta.tool_calls
          // 3. Direct tool_calls on choices[0].tool_calls (as shown in logs)
          let toolCall = null;
          
          if (data.choices && data.choices[0]) {
            if (data.choices[0].delta && data.choices[0].delta.tool_calls && data.choices[0].delta.tool_calls.length > 0) {
              // Format 1/2
              toolCall = data.choices[0].delta.tool_calls[0];
            } else if (data.choices[0].tool_calls && data.choices[0].tool_calls.length > 0) {
              // Format 3
              toolCall = data.choices[0].tool_calls[0]; 
            }
          }
          
          if (toolCall) {
            // Store the tool call details
            this.currentToolCall = {
              id: toolCall.id || '',
              name: toolCall.function.name,
              args: {}
            };
            
            if (toolCall.function && toolCall.function.arguments) {
              try {
                this.currentToolCall.args = JSON.parse(toolCall.function.arguments);
              } catch (e) {
                // If parsing fails, use the raw string
                this.currentToolCall.args = { query: toolCall.function.arguments };
              }
            }
            
            result.toolCalls = this.currentToolCall;
            debug('Set toolCalls in result to:', JSON.stringify(this.currentToolCall).substring(0, 100));
          }
        } catch (e) {
          debug('Error parsing tool call in parseReply:', e);
        }
      }
      
      // If we're at the end of the stream and have a pending tool call
      if ((jsonChunk.includes('"finish_reason":"tool_calls"') || 
           jsonChunk.includes('"native_finish_reason":"tool_calls"')) && 
          this.processingToolCall) {
        debug('Detected end of tool call stream');
        result.toolCalls = this.currentToolCall;
      }
      
      return result;
    } catch (e) {
      // If standard parsing fails, return a basic message
      debug('Error in GrokReader parseReply:', e, 'for chunk:', chunk.substring(0, 100));
      return {
        content: chunk,
        isEnd: false
      };
    }
  }
  
  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    // First check if we have tool calls already set
    if (respMsg.toolCalls && typeof respMsg.toolCalls === 'object') {
      const tc = respMsg.toolCalls as any;
      if (tc.name) {
        debug('Using existing toolCalls from message:', tc.name);
        return respMsg.toolCalls as ITool;
      }
    }
    
    // Then try the standard OpenAI tool_calls parsing
    try {
      const standardTool = super.parseTools(respMsg);
      if (standardTool) {
        return standardTool;
      }
    } catch (e) {
      debug('Error in standard tool parsing:', e);
    }
    
    // Specialized handling for Grok format
    if (respMsg.content || (respMsg as any).raw) {
      try {
        // Try to parse the raw response data from any available source
        let rawData = null;
        const rawContent = (respMsg as any).raw || respMsg.content;
        
        if (rawContent) {
          try {
            if (typeof rawContent === 'string') {
              rawData = JSON.parse(rawContent);
            } else if (typeof rawContent === 'object') {
              rawData = rawContent;
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
        
        // Try finding tool calls in parsed data
        if (rawData && rawData.choices && 
            rawData.choices[0]) {
          
          // Check for multiple tool call formats
          let toolCall = null;
          
          if (rawData.choices[0].delta && 
              rawData.choices[0].delta.tool_calls && 
              rawData.choices[0].delta.tool_calls.length > 0) {
            toolCall = rawData.choices[0].delta.tool_calls[0];
          } else if (rawData.choices[0].tool_calls && 
                     rawData.choices[0].tool_calls.length > 0) {
            toolCall = rawData.choices[0].tool_calls[0];
          }
          
          if (toolCall && toolCall.function && toolCall.function.name) {
            debug('Detected Grok-specific tool call format:', JSON.stringify(toolCall).substring(0, 200));
            
            let args = {};
            if (toolCall.function && toolCall.function.arguments) {
              try {
                args = JSON.parse(toolCall.function.arguments);
              } catch (e) {
                // If parsing fails, use the raw string
                args = { query: toolCall.function.arguments };
              }
            }
            
            return {
              id: toolCall.id || '',
              name: toolCall.function.name,
              args: args
            };
          }
        }
      } catch (e) {
        debug('Error parsing raw data for Grok tool calls:', e);
      }
    }
    
    // Use the current tool call if we're processing one
    if (this.processingToolCall && 
        this.currentToolCall && 
        this.currentToolCall.name) {
      debug('Using tracked tool call:', this.currentToolCall.name);
      return this.currentToolCall as ITool;
    }
    
    return null;
  }
}

export default class OMNIChatService
  extends OpenAIChatService
  implements INextChatService
{
  constructor(context: IChatContext) {
    super(context);
    this.provider = OMNI;
  }

  protected getReaderType() {
    // We'll still return OpenAIReader as the default to satisfy the type system
    // but we'll override createReader() to actually use the appropriate reader
    return OpenAIReader;
  }

  protected createReader(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): IChatReader {
    // Get the current model information
    const model = this.context.getModel();
    const modelName = model.name?.toLowerCase() || '';
    const modelGroup = model.group?.toLowerCase() || '';
    
    debug(`Selecting reader for model: ${modelName}, group: ${modelGroup}`);
    
    // Select reader based on model group or name
    if (modelGroup.includes('gemini') || modelName.includes('gemini') || modelName.includes('google/')) {
      debug(`Using GoogleReader for ${modelName}`);
      return new GoogleReader(reader);
    } else if (modelGroup.includes('claude') || 
              modelName.includes('claude') || 
              modelName.includes('anthropic/')) {
      debug(`Using AnthropicReader for ${modelName}`);
      return new AnthropicReader(reader);
    } else if (modelGroup.includes('grok') || 
              modelName.includes('grok') || 
              modelName.includes('x-ai/') ||
              modelName === 'x-ai/grok-beta') {
      debug(`Using GrokReader (specialized for Grok-specific format) for ${modelName}`);
      return new GrokReader(reader);
    } else if (modelGroup.includes('mistral') || 
              modelGroup.includes('ministral') || 
              modelGroup.includes('codestral') || 
              modelGroup.includes('pixtral') || 
              modelName.includes('mistral/')) {
      debug(`Using OpenAIReader for ${modelName} (Mistral family uses OpenAI format)`);
      return new OpenAIReader(reader);
    } else if (modelGroup.includes('moonshot') || 
              modelName.includes('moonshot')) {
      debug(`Using OpenAIReader for ${modelName} (Moonshot uses OpenAI format)`);
      return new OpenAIReader(reader);
    } else if (modelGroup.includes('open source') || 
              modelName.includes('ollama')) {
      debug(`Using OllamaChatReader for ${modelName}`);
      return new OllamaChatReader(reader);
    } else if (modelGroup.includes('chatbro')) {
      debug(`Using ChatBroReader for ${modelName}`);
      return new ChatBroReader(reader);
    } else if (modelGroup.includes('gpt-3.5') || 
              modelGroup.includes('gpt-4') || 
              modelName.includes('openai/')) {
      debug(`Using OpenAIReader for ${modelName} (OpenAI format)`);
      return new OpenAIReader(reader);
    }
    
    // Default to OpenAIReader for all other models as a safe fallback
    debug(`Using default OpenAIReader for unrecognized model: ${modelName}`);
    return new OpenAIReader(reader);
  }

  private getUserId() {
    const { session } = useAuthStore.getState();
    return session?.user.id;
  }

  protected async makeRequest(
    messages: IChatRequestMessage[]
  ): Promise<Response> {
    const payload = await this.makePayload(messages);
    debug('About to make a request, payload:\r\n', payload);
    
    // Create a custom payload for OpenRouter
    const extendedPayload: any = {
      ...payload,
      // OpenRouter specific parameters can be added here if needed
      http_referer: 'https://omni.agisurge.com',
      //models: ['google/gemini-2.0-flash-001', 'openai/gpt-4o', 'anthropic/claude-3.7-sonnet', 'x-ai/grok-beta'],
      include_reasoning: true,
      transforms: ["middle-out"], // Improve JSON mode accuracy
    };
    
    // Add OpenRouter-specific headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://omni.agisurge.com',
      'X-Title': 'OMNI'
    };
    
    const { base, key } = this.apiSettings;
    
    // Use the API key from settings if available, fallback to user ID
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    } else {
      const userId = this.getUserId();
      if (!userId) {
        throw new Error('No API key provided and user is not authenticated');
      }
      headers['Authorization'] = `Bearer ${userId}`;
    }
    
    // For OMNI provider, always use the correct OpenRouter API URL
    let finalUrl;
    if (this.provider.name === 'OMNI') {
      finalUrl = new URL('https://openrouter.ai/api/v1/chat/completions');
    } else {
      // Use correct path for other providers
      finalUrl = urlJoin('api/v1/chat/completions', base);
    }
    
    debug('Making request to API URL:', finalUrl.toString());
    
    const response = await fetch(finalUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(extendedPayload),
      signal: this.abortController.signal,
    });
    
    return response;
  }
} 