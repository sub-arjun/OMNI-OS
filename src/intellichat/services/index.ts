import {  IChatContext } from '../types';
import { ProviderType } from '../../providers/types';
import AnthropicChatService from './AnthropicChatService';
import AzureChatService from './AzureChatService';
import OllamaChatService from './OllamaChatService';
import OpenAIChatService from './OpenAIChatService';
import GoogleChatService from './GoogleChatService';
import BaiduChatService from './BaiduChatService';
import ChatBroChatService from './ChatBroChatService';
import MoonshotChatService from './MoonshotChatService';
import MistralChatService from './MistralChatService';
import FireChatService from './FireChatService';
import DoubaoChatService from './DoubaoChatService';
import GrokChatService from './GrokChatService';
import DeepSeekChatService from './DeepSeekChatService';
import OMNIChatService from './OMNIChatService';
import INextChatService from './INextCharService';

export default function createService(
  providerName: ProviderType | string,
  chatCtx: IChatContext
): INextChatService {
  // Handle OMNI Edge as an alias for Ollama
  if (providerName === 'OMNI Edge') {
    console.log('Mapping OMNI Edge to Ollama service');
    return new OllamaChatService(chatCtx);
  }

  try {
    switch (providerName) {
      case 'Anthropic':
        return new AnthropicChatService(chatCtx);
      case 'OpenAI':
        return new OpenAIChatService(chatCtx);
      case 'Azure':
        return new AzureChatService(chatCtx);
      case 'Google':
        return new GoogleChatService(chatCtx);
      case 'Baidu':
        return new BaiduChatService(chatCtx);
      case 'Mistral':
        return new MistralChatService(chatCtx);
      case 'Moonshot':
        return new MoonshotChatService(chatCtx);
      case 'Ollama':
        return new OllamaChatService(chatCtx);
      case 'ChatBro':
        return new ChatBroChatService(chatCtx);
      case '5ire':
        return new FireChatService(chatCtx);
      case 'Doubao':
        return new DoubaoChatService(chatCtx);
      case 'Grok':
        return new GrokChatService(chatCtx);
      case 'DeepSeek':
        return new DeepSeekChatService(chatCtx);
      case 'OMNI':
        return new OMNIChatService(chatCtx);
      default:
        console.error(`Invalid provider: ${providerName}, falling back to OMNI`);
        return new OMNIChatService(chatCtx);
    }
  } catch (error) {
    console.error(`Error creating service for provider ${providerName}:`, error);
    // Fallback to OMNI service
    return new OMNIChatService(chatCtx);
  }
}
