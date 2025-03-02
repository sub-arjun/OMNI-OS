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

const debug = Debug('OMNI-OS:intellichat:OMNIChatService');

export default class OMNIChatService
  extends OpenAIChatService
  implements INextChatService
{
  constructor(context: IChatContext) {
    super(context);
    this.provider = OMNI;
  }

  protected getReaderType() {
    return OpenAIReader;
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
      models: ['google/gemini-2.0-flash-001','openai/gpt-4o', 'anthropic/claude-3.7-sonnet'],
      //include_reasoning: true,
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
    
    // Use correct path for the OpenRouter API endpoint
    const url = urlJoin('/v1/chat/completions', base);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(extendedPayload),
      signal: this.abortController.signal,
    });
    
    return response;
  }
} 