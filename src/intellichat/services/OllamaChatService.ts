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

const debug = Debug('OMNI-OS:intellichat:OllamaChatService');
export default class OllamaChatService
  extends OpenAIChatService
  implements INextChatService {
  constructor(context: IChatContext) {
    super(context);
    this.provider = Ollama;
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

  protected makeToolMessages(
    tool: ITool,
    toolResult: any,
  ): IChatRequestMessage[] {
    return [
      {
        role: 'assistant',
        tool_calls: [
          {
            id: tool.id,
            type: 'function',
            function: {
              arguments: tool.args, // unlike openai, ollama tool args is not a string
              name: tool.name,
            },
          },
        ],
      },
      {
        role: 'tool',
        name: tool.name,
        content:
          typeof toolResult === 'string' ? toolResult : toolResult.content,
        tool_call_id: tool.id,
      },
    ];
  }

  protected async makePayload(
    messages: IChatRequestMessage[]
  ): Promise<IChatRequestPayload> {
    const payload = await super.makePayload(messages);
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
    return {
      ...payload,
      messages: ollamaMessages,
      stream: true,
    };
  }

  protected async makeRequest(
    messages: IChatRequestMessage[]
  ): Promise<Response> {
    const payload = await this.makePayload(messages);
    debug('Send Request, payload:\r\n', payload);
    const { base } = this.apiSettings;
    const url = urlJoin('/api/chat', base);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: this.abortController.signal,
    });
    return response;
  }
}
