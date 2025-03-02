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
    
    // Extract reasoning content from various possible locations
    let reasoning = '';
    
    // OpenRouter + Claude 3.7 Sonnet format (reasoning in choices[0].delta.reasoning)
    if (choice.delta && choice.delta.reasoning !== undefined) {
      // Only use non-null reasoning values
      if (choice.delta.reasoning !== null) {
        reasoning = choice.delta.reasoning;
      }
    }
    // Standard OpenAI reasoning_content field (if available)
    else if (choice.delta && choice.delta.reasoning_content) {
      reasoning = choice.delta.reasoning_content;
    }
    // Claude 3.7 Sonnet format direct (when proxied through OpenAI-compatible endpoint)
    else if (choice.reasoning) {
      reasoning = choice.reasoning;
    }
    // Support for reasoning in nested delta content (some providers use this format)
    else if (choice.delta && choice.delta.choices && 
             choice.delta.choices[0] && choice.delta.choices[0].reasoning) {
      reasoning = choice.delta.choices[0].reasoning;
    }
    // OpenRouter specific format for Claude models
    else if (data.model && data.model.includes('claude') && choice.delta) {
      // For OpenRouter + Claude, check if the model info is available
      if (data.model.includes('claude-3') && data.model.includes('sonnet')) {
        // The reasoning might be in a special field or encoded in the content
        // Try to extract it from the raw response
        try {
          // Access potential fields that might contain reasoning
          if (choice.delta.thinking) {
            reasoning = choice.delta.thinking;
          } else if (choice.thinking) {
            reasoning = choice.thinking;
          } else if (data.thinking) {
            reasoning = data.thinking;
          }
          
          // As a last resort, try to extract reasoning from the content
          // This is needed because OpenRouter might embed reasoning in content
          if (!reasoning && choice.delta.content) {
            const content = choice.delta.content;
            // Look for thinking or reasoning patterns within the content
            const thinkMatch = content.match(/<think>(.*?)<\/think>/s);
            if (thinkMatch && thinkMatch[1]) {
              reasoning = thinkMatch[1];
            }
          }
        } catch (error) {
          debug('Error extracting reasoning from OpenRouter response:', error);
        }
      }
    }

    const content = choice.delta?.content || '';
    
    return {
      content: content,
      reasoning: reasoning,
      isEnd: isFinished,
      toolCalls: choice.delta?.tool_calls,
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
