import Debug from 'debug';
import {
  IChatContext,
  IChatRequestMessage,
  IChatRequestPayload,
  IChatMessage
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
import OMNIAgentReader from 'intellichat/readers/OMNIAgentReader';
import useSettingsStore from 'stores/useSettingsStore';

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
  // Add a cleanup flag to track resource cleanup
  private hasCleanedUp = false;
  // Reader instance reference for proper cleanup
  private activeReader: IChatReader | null = null;

  constructor(context: IChatContext) {
    super(context);
    this.provider = OMNI;
  }
  
  /**
   * Override the system message with OMNI-specific default prompt when appropriate
   * @returns Modified system message with OMNI identification
   */
  protected getSystemMessage(): string {
    // Get the original system message from context
    const originalSystemMessage = this.context.getSystemMessage();
    
    // Default OMNI prompt to use when no system message is set or as base for custom prompts
    const defaultOMNIPrompt = "Your name is OMNI. You are developed by OMNI AI.";
    
    // If no system message is set, use the default OMNI prompt
    if (!originalSystemMessage || originalSystemMessage.trim() === '') {
      debug('Using default OMNI system prompt');
      return defaultOMNIPrompt;
    }
    
    // If a custom system message is set, combine default OMNI prompt with the custom prompt
    debug('Combining default OMNI prompt with custom system message');
    return `${defaultOMNIPrompt} Your Base AI Model Name is OMNI unless the it is specified otherwise in the remaining prompt. If a new name is specified, use that name instead of OMNI. ${originalSystemMessage}`;
  }
  
  /**
   * Override createReader to use the appropriate reader based on the model
   * This avoids type compatibility issues with getReaderType
   */
  protected createReader(reader: ReadableStreamDefaultReader<Uint8Array>): IChatReader {
    // Get model from context
    const model = this.context.getModel();
    const modelName = model.name || '';
    
    let readerInstance: IChatReader;
    
    // Select the appropriate reader based on the model
    if (modelName === 'anthropic/claude-3.7-sonnet:beta' || model.agentEnabled) {
      debug('Using OMNI Agent reader for Claude 3.7 Sonnet');
      readerInstance = new OMNIAgentReader(reader);
    } else if (modelName.startsWith('anthropic/')) {
      // Claude models through OpenRouter
      debug('Using Anthropic reader for Claude model via OpenRouter');
      readerInstance = new AnthropicReader(reader);
    } else if (modelName.startsWith('google/')) {
      // Google models through OpenRouter
      debug('Using Google reader for Google model via OpenRouter');
      readerInstance = new GoogleReader(reader);
    } else {
      // Default to OpenAI reader as fallback for other models
      debug('Using default OpenAI reader for model:', modelName);
      readerInstance = new OpenAIReader(reader);
    }
    
    // Store reference for cleanup
    this.activeReader = readerInstance;
    return readerInstance;
  }

  /**
   * Ensure proper cleanup when aborting requests
   */
  public abort(): void {
    try {
      debug('Aborting OMNI service...');
      // Call parent abort method
      super.abort();
      
      // Release resources
      this.releaseResources();
      
      debug('OMNI service aborted and cleaned up');
    } catch (err) {
      console.error('Error while aborting OMNI service:', err);
    }
  }

  // Add a method to properly release memory
  private async releaseResources(): Promise<void> {
    try {
      debug('Explicitly releasing OMNI service resources');
      
      // Abort any ongoing requests
      try {
        this.abortController.abort();
        // Create a new abort controller for future requests
        this.abortController = new AbortController();
      } catch (err) {
        console.error('Error aborting requests:', err);
      }
      
      // Clean up reader if it exists
      if (this.activeReader) {
        try {
          debug('Cleaning up active reader');
          // Clear the reference
          this.activeReader = null;
        } catch (err) {
          console.error('Error cleaning up reader:', err);
        }
      }
      
      // Mark as cleaned up
      this.hasCleanedUp = true;
    } catch (err) {
      console.error('Error releasing OMNI service resources:', err);
    }
  }

  /**
   * Handle chat with proper resource cleanup
   */
  public async chat(messages: IChatRequestMessage[]): Promise<void> {
    debug('Starting chat with OMNI provider');
    
    // Reset cleanup flag for new chat
    this.hasCleanedUp = false;
    
    try {
      await super.chat(messages);
    } catch (error) {
      debug('Error in OMNI chat:', error);
      // Ensure cleanup happens on error
      await this.releaseResources();
      throw error;
    }
  }

  protected async makeRequest(
    messages: IChatRequestMessage[]
  ): Promise<Response> {
    try {
      const payload = await this.makePayload(messages);
      // Get API settings from the store
      const { api, specializedModel } = useSettingsStore.getState();
      const { base, key, model: modelName } = api;
      
      // Get the current model
      const model = this.context.getModel();
      
      // Add debugging for model selection
      console.log(`Final model selection - Name: ${model.name}, Label: ${model.label}, SpecializedModel: ${specializedModel || 'None'}`);
      
      // Extract payload fields
      const {
        messages: _msgs,
        presence_penalty,
        max_tokens,
        stream,
        temperature,
        top_p,
        tools,
      } = payload;
      
      // Start with base payload
      const extendedPayload: Record<string, any> = {
        messages: _msgs,
        stream: stream || true,
        temperature: temperature,
        max_tokens: max_tokens,
      };
      
      // Add model parameter for OpenRouter - always use the model.name which comes from context
      // This ensures specialized models are honored
      if (model && model.name) {
        extendedPayload.model = model.name;
        
        // Double-check for specializedModel
        if (specializedModel) {
          // Verify the model matches expected specialized model
          const expectedModelMap: {[key: string]: string} = {
            'Deep-Searcher-R1': 'perplexity/sonar-reasoning-pro',
            'Deep-Thinker-R1': 'perplexity/r1-1776',
            'Flash-2.0': 'google/gemini-2.0-flash-001'
          };
          
          const expectedModel = expectedModelMap[specializedModel];
          if (expectedModel && model.name !== expectedModel) {
            console.warn(`Model mismatch: Expected ${expectedModel} for ${specializedModel}, but got ${model.name}. Forcing correct model.`);
            extendedPayload.model = expectedModel;
          }
        }
      } else {
        extendedPayload.model = modelName;
      }
      
      // Add optional parameters if they exist
      if (presence_penalty) extendedPayload.presence_penalty = presence_penalty;
      if (top_p) extendedPayload.top_p = top_p;
      if (tools) extendedPayload.tools = tools;
      
      // Define headers for the API request
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://www.omni-os.com/', // Identify the app to OpenRouter
      };
      
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
      
      // Log the final payload for debugging
      if (model.agentEnabled || modelName === 'anthropic/claude-3.7-sonnet:beta') {
        console.log('OMNI Agent: Final payload structure:', Object.keys(extendedPayload).join(', '));
      }
      
      // Additional logging for specialized models
      if (specializedModel) {
        console.log(`Specialized model request - Model: ${model.name}, Payload model: ${extendedPayload.model}`);
      }
      
      const response = await fetch(finalUrl.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(extendedPayload),
        signal: this.abortController.signal,
      });
      
      return response;
    } catch (error) {
      // Handle aborted requests gracefully
      if (error instanceof DOMException && error.name === 'AbortError') {
        debug('Request was aborted');
        throw new Error('Request aborted');
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Override to use our custom getSystemMessage method
   */
  protected async makePayload(
    messages: IChatRequestMessage[]
  ): Promise<IChatRequestPayload> {
    // Get the base payload from the parent class
    const payload = await super.makePayload(messages);
    
    // For Anthropic models, add the system message to the system field
    const model = this.context.getModel();
    const modelName = model.name?.toLowerCase() || '';
    const modelGroup = model.group?.toLowerCase() || '';
    
    // For Anthropic models (Claude), use the system field
    if (modelName.includes('claude') || modelName.includes('anthropic') || modelGroup.includes('claude')) {
      // Replace or set the system field with our custom system message
      const customSystemMessage = this.getSystemMessage();
      if (customSystemMessage) {
        payload.system = customSystemMessage;
      }
    }
    
    return payload;
  }

  /**
   * Override to use our custom getSystemMessage method when adding system messages
   */
  protected async makeMessages(
    messages: IChatRequestMessage[],
  ): Promise<IChatRequestMessage[]> {
    const result = [];
    // Use our custom getSystemMessage method instead of context.getSystemMessage()
    const systemMessage = this.getSystemMessage();
    let sysRole = 'system';
    
    // Use different role for certain models like o1, o3
    const modelName = this.getModelName().toLowerCase();
    if (['o1', 'o3'].some((prefix) => modelName.startsWith(prefix))) {
      sysRole = 'developer';
    }
    
    // Add system message if available
    if (systemMessage && systemMessage.trim() !== '') {
      result.push({
        role: sysRole,
        content: systemMessage,
      });
    }
    
    // Add context messages
    this.context.getCtxMessages().forEach((msg: IChatMessage) => {
      result.push({
        role: 'user',
        content: msg.prompt,
      });
      result.push({
        role: 'assistant',
        content: msg.reply,
      });
    });
    
    // Add current messages
    for (const msg of messages) {
      if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          content: JSON.stringify(msg.content),
          name: msg.name,
          tool_call_id: msg.tool_call_id,
        });
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        result.push(msg);
      } else {
        const { content } = msg;
        if (typeof content === 'string') {
          result.push({
            role: 'user',
            content: await this.convertPromptContent(content),
          });
        } else {
          result.push({
            role: 'user',
            content,
          });
        }
      }
    }
    
    return result as IChatRequestMessage[];
  }

  private getUserId() {
    const { session } = useAuthStore.getState();
    return session?.user.id;
  }
} 