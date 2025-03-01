import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import IChatReader, { ITool } from './IChatReader';

const debug = Debug('OMNI-OS:intellichat:OpenAIReader');

export default class OpenAIReader extends BaseReader implements IChatReader {
  protected parseReply(chunk: string): IChatResponseMessage {
    const data = JSON.parse(chunk);
    if (data.error) {
      throw new Error(data.error.message);
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
    
    if (data.choices.length === 0) {
      return {
        content: '',
        reasoning: '',
        isEnd: false,
        toolCalls: [],
      };
    }
    
    const choice = data.choices[0];
    const isFinished = choice.finish_reason != null;
    
    return {
      content: choice.delta.content || '',
      reasoning: choice.delta.reasoning_content || '',
      isEnd: isFinished,
      toolCalls: choice.delta.tool_calls,
    };
  }

  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (respMsg.toolCalls && respMsg.toolCalls.length > 0) {
      return {
        id: respMsg.toolCalls[0].id,
        name: respMsg.toolCalls[0].function.name,
      };
    }
    return null;
  }

  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    try {
      if (respMsg.isEnd || !respMsg.toolCalls) {
        return null;
      }
      const toolCalls = respMsg.toolCalls[0];
      return {
        index: toolCalls.index || 0,
        args: toolCalls.function.arguments,
      };
    } catch (err) {
      console.error('parseToolArgs', err);
    }
    return null;
  }
}
