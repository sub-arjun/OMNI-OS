import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import { ITool } from './IChatReader';

const debug = Debug('OMNI-OS:intellichat:AnthropicReader');

export default class AnthropicReader extends BaseReader {
  protected processChunk(chunk: string): IChatResponseMessage | null {
    try {
      // Each chunk is a complete JSON message in Anthropic's format
      return this.parseReply(chunk);
    } catch (error) {
      debug('Failed to process chunk:', error);
      return null;
    }
  }

  protected parseReply(chunk: string): IChatResponseMessage {
    const data = JSON.parse(chunk);
    
    // Check for reasoning in the data
    // Support both regular Anthropic streaming format and Claude 3.7 Sonnet format
    let reasoning = '';
    
    // Claude 3.7 Sonnet format has reasoning in choices array
    if (data.choices && data.choices.length > 0 && data.choices[0].reasoning) {
      reasoning = data.choices[0].reasoning;
    }
    
    if (data.type === 'content_block_start') {
      if (data.content_block.type === 'tool_use') {
        return {
          toolCalls: [
            {
              id: data.content_block.id,
              name: data.content_block.name,
              args:'',
            },
          ],
          reasoning,
          isEnd: false,
        };
      }
      return {
        content: data.content_block.text,
        reasoning,
        isEnd: false,
      };
    } else if (data.type === 'content_block_delta') {
      if (data.delta.type === 'input_json_delta') {
        return {
          content: '',
          reasoning,
          toolCalls: [
            {
              args: data.delta.partial_json,
              index: 0,
            },
          ],
        };
      }
      return {
        content: data.delta.text,
        reasoning,
        isEnd: false,
      };
    } else if (data.type === 'message_start') {
      return {
        content: '',
        reasoning,
        isEnd: false,
        inputTokens: data.message.usage.input_tokens,
        outputTokens: data.message.usage.output_tokens,
      };
    } else if (data.type === 'message_delta') {
      return {
        content: '',
        reasoning,
        isEnd: false,
        outputTokens: data.usage.output_tokens,
      };
    } else if (data.type === 'message_stop') {
      return {
        content: '',
        reasoning,
        isEnd: true,
      };
    } else if (data.type === 'error') {
      return {
        content: '',
        reasoning,
        error: {
          type: data.delta.type,
          message: data.delta.text,
        },
      };
    } else if (data.type === 'ping') {
      return {
        content: '',
        reasoning,
        isEnd: false,
      };
    } else if (data.object === 'chat.completion.chunk') {
      // Claude 3.7 Sonnet format
      const content = data.choices?.[0]?.delta?.text || '';
      return {
        content,
        reasoning,
        isEnd: data.choices?.[0]?.finish_reason !== null,
      };
    } else {
      console.warn('Unknown message type', data);
      return {
        content: '',
        reasoning,
        isEnd: false,
      };
    }
  }

  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (respMsg.toolCalls && respMsg.toolCalls.length > 0) {
      return {
        id: respMsg.toolCalls[0].id,
        name: respMsg.toolCalls[0].name,
      };
    }
    return null;
  }

  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    debug('parseToolArgs', JSON.stringify(respMsg));
    try {
      if (respMsg.isEnd || !respMsg.toolCalls) {
        return null;
      }
      return respMsg.toolCalls[0];
    } catch (err) {
      console.error('parseToolArgs', err);
    }
    return null;
  }
}
