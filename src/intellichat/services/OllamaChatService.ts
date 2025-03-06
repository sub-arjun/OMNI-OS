import Debug from 'debug';
import Ollama from '../../providers/Ollama';
import {
  IChatContext,
  IChatRequestMessage,
  IChatRequestPayload,
  IChatRequestMessageContent,
} from 'intellichat/types';
import INextChatService from './INextCharService';
import OpenAIChatService from './OpenAIChatService';
import OllamaReader from 'intellichat/readers/OllamaChatReader';
import { ITool } from 'intellichat/readers/IChatReader';
import { urlJoin, getBase64, splitByImg } from 'utils/util';
import useSettingsStore from 'stores/useSettingsStore';

const debug = Debug('OMNI-OS:intellichat:OllamaChatService');
export default class OllamaChatService
  extends OpenAIChatService
  implements INextChatService {
  
  constructor(context: IChatContext) {
    super(context);
    this.provider = Ollama;
    
    // Override the modelMapping to empty for Ollama
    // This ensures model names are passed through directly
    this.modelMapping = {};
    
    // Log the model we're using on initialization
    const modelName = this.context.getModel().name;
    debug(`OllamaChatService initialized with model: ${modelName}`);
  }

  // Override the getModelName method to ensure we use the exact model name from our dedicated storage
  protected getModelName() {
    // First try to get the model from our dedicated storage
    const ollamaModel = window.electron?.store?.get('settings.ollama.currentModel', null);
    
    if (ollamaModel) {
      debug(`Using model from dedicated Ollama storage: ${ollamaModel}`);
      return ollamaModel;
    }
    
    // Fallback to getting the model from context
    const model = this.context.getModel();
    const modelName = model.name;
    
    // Get current api settings for cross-reference
    const { api } = useSettingsStore.getState();
    
    debug(`Ollama using model from context: ${modelName}, API settings model: ${api.model}`);
    
    // Store it in our dedicated storage for future use
    if (modelName && modelName !== 'default') {
      debug(`Storing model in dedicated Ollama storage: ${modelName}`);
      window.electron.store.set('settings.ollama.currentModel', modelName);
    }
    
    // Return the exact model name without mapping
    return modelName;
  }

  protected getReaderType() {
    return OllamaReader;
  }

  protected async convertPromptContent(
    content: string,
  ): Promise<string | IChatRequestMessageContent[]> {
    if (this.context.getModel().vision?.enabled) {
      const items = splitByImg(content);
      const result: IChatRequestMessageContent[] = [];
      for (let item of items) {
        if (item.type === 'image') {
          let data = '';
          if (item.dataType === 'URL') {
            data = await getBase64(item.data);
            data = data.split('base64,')[1]; // Remove data:image/png;base64,
          } else {
            data = item.data.split('base64,')[1]; // Remove data:image/png;base64,
          }
          result.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: item.mimeType as string,
              data,
            },
          });
        } else if (item.type === 'text') {
          result.push({
            type: 'text',
            text: item.data,
          });
        } else {
          throw new Error('Unknown message type');
        }
      }
      return result;
    }
    return content;
  }

  // Override the parent method to make sure we're correctly processing tools for Ollama
  protected createToolCall(tool: ITool): any {
    // Use Ollama's tool format
    return {
      type: 'function',
      id: tool.id,
      function: {
        name: tool.name,
        arguments: tool.args, // unlike openai, ollama tool args is not a string
      },
    };
  }

  protected async makePayload(
    messages: IChatRequestMessage[]
  ): Promise<IChatRequestPayload> {
    // Don't use super.makePayload as it may apply model mapping
    // Instead, create our own payload with the exact model name
    
    // Get the exact model name (using our overridden getModelName method)
    const modelName = this.getModelName();
    
    // Log for debugging
    debug(`Ollama makePayload - Using model: ${modelName}`);
    debug(`Ollama makePayload - Processing ${messages.length} messages`);
    
    // Log all messages for debugging
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const contentPreview = typeof msg.content === 'string' 
        ? msg.content.substring(0, 50) + '...' 
        : '[complex content]';
      debug(`Message ${i}: role=${msg.role}, content=${contentPreview}`);
    }
    
    // Convert messages to Ollama format
    const ollamaMessages = await Promise.all(
      messages.map(async (msg) => {
        const converted = {
          role: msg.role,
          content: typeof msg.content === 'string' 
            ? await this.convertPromptContent(msg.content)
            : msg.content,
        };
        return converted;
      })
    );
    
    // Create the payload directly with the correct model name
    const finalPayload: IChatRequestPayload = {
      model: modelName,
      messages: ollamaMessages,
      temperature: this.context.getTemperature(),
      stream: true,
    };
    
    // If max tokens is set, add it to the payload
    if (this.context.getMaxTokens()) {
      // Use type assertion to add the max_tokens property
      (finalPayload as any).max_tokens = this.context.getMaxTokens();
    }
    
    // Log the final payload for debugging
    debug('Ollama final payload model:', finalPayload.model);
    debug(`Ollama final payload contains ${finalPayload.messages?.length || 0} messages`);
    
    return finalPayload;
  }

  // Override to ensure we're correctly sending the request to Ollama
  protected async makeRequest(
    messages: IChatRequestMessage[]
  ): Promise<Response> {
    const payload = await this.makePayload(messages);
    debug('Send Request to Ollama, payload model:', payload.model);
    debug(`Send Request to Ollama with ${payload.messages?.length || 0} messages`);
    
    const { base } = this.apiSettings;
    const url = urlJoin('/api/chat', base);
    
    debug(`Sending request to URL: ${url.toString()}`);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: this.abortController.signal,
    });
    
    debug(`Received response from Ollama with status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      debug(`Ollama API error: ${errorText}`);
      throw new Error(`Ollama API error: ${errorText}`);
    }
    
    return response;
  }

  // Override the chat method to ensure proper handling of message history
  public async chat(messages: IChatRequestMessage[]) {
    debug(`OllamaChatService.chat called with ${messages.length} messages`);
    
    // Log message details for debugging
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const contentPreview = typeof msg.content === 'string' 
        ? (msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content)
        : '[complex content]';
      debug(`Message ${i}: role=${msg.role}, content=${contentPreview}`);
    }
    
    // Ensure we don't lose previous messages
    if (messages.length <= 1) {
      debug('WARNING: Only one message found in chat. Adding context messages from history...');
      
      // Get context messages from chat history
      const ctxMessages = this.context.getCtxMessages();
      
      debug(`Found ${ctxMessages.length} context messages to add`);
      
      if (ctxMessages.length > 0) {
        // Convert context messages to the format expected by the API
        const previousMessages: IChatRequestMessage[] = ctxMessages.map(msg => {
          // Determine the role based on message properties
          let role: 'assistant' | 'user' | 'system' = 'user';
          
          // If it's a reply from the assistant
          if (msg.reply && msg.reply.trim() !== '') {
            role = 'assistant';
          } 
          // If it has a system message
          else if (msg.systemMessage && msg.systemMessage.trim() !== '') {
            role = 'system';
          }
          
          // Determine content based on role
          const content = role === 'assistant' ? msg.reply : 
                         role === 'system' ? (msg.systemMessage || '') : 
                         msg.prompt;
          
          return {
            role,
            content
          };
        });
        
        // Add system message if available
        const systemMessage = this.context.getSystemMessage();
        if (systemMessage) {
          previousMessages.unshift({
            role: 'system',
            content: systemMessage
          });
        }
        
        // After converting context messages, add detailed logging
        debug('Converted context messages:');
        for (let i = 0; i < previousMessages.length; i++) {
          const msg = previousMessages[i];
          const contentPreview = typeof msg.content === 'string' 
            ? (msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content)
            : '[complex content]';
          debug(`Context Message ${i}: role=${msg.role}, content=${contentPreview}`);
        }
        
        // Combine previous messages with current message
        messages = [...previousMessages, ...messages];
        debug(`Using ${messages.length} messages after adding context`);
        
        // After combining messages, add detailed logging
        debug('Final messages to be sent:');
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const contentPreview = typeof msg.content === 'string' 
            ? (msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content)
            : '[complex content]';
          debug(`Final Message ${i}: role=${msg.role}, content=${contentPreview}`);
        }
      }
    }
    
    // Call the parent chat method with all messages
    return await super.chat(messages);
  }
}
