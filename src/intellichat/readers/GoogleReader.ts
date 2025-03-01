import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import { extractFirstLevelBrackets } from 'utils/util';
import { IReadResult, ITool } from './IChatReader';

const debug = Debug('OMNI-OS:intellichat:GoogleReader');

export default class GoogleReader extends BaseReader {
  protected parseReply(chunk: string): IChatResponseMessage {
    let _chunk = chunk.trim();
    try {
      const data = JSON.parse(_chunk);
      if (data.candidates) {
        const firstCandidate = data.candidates[0];
        return {
          content: firstCandidate.content.parts[0].text || '',
          isEnd: firstCandidate.finishReason,
          inputTokens: data.usageMetadata.promptTokenCount,
          outputTokens: data.usageMetadata.candidatesTokenCount,
          toolCalls: firstCandidate.content.parts[0].functionCall,
        };
      } else {
        return {
          content: '',
          isEnd: false,
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
        };
      }
    } catch (err) {
      console.error('Error parsing JSON:', err);
      return {
        content: '',
        isEnd: false,
      };
    }
  }

  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (respMsg.toolCalls) {
      return {
        id: '',
        name: respMsg.toolCalls.name,
        args: respMsg.toolCalls.args,
      };
    }
    return null;
  }

  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    if (respMsg.toolCalls) {
      return {
        index: 0,
        args: respMsg.toolCalls.args,
      };
    }
    return null;
  }

  public async read({
    onError,
    onProgress,
    onToolCalls,
  }: {
    onError: (error: any) => void;
    onProgress: (chunk: string) => void;
    onToolCalls: (toolCalls: any) => void;
  }): Promise<IReadResult> {
    const decoder = new TextDecoder('utf-8');
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let done = false;
    let tool = null;
    try {
      while (!done) {
        /* eslint-disable no-await-in-loop */
        const data = await this.streamReader.read();
        done = data.done || false;
        const value = decoder.decode(data.value);
        const items = extractFirstLevelBrackets(value);
        for (const item of items) {
          const response = this.parseReply(item);
          content += response.content;
          if (response.inputTokens) {
            inputTokens = response.inputTokens;
          }
          if (response.outputTokens) {
            outputTokens += response.outputTokens;
          }
          if (response.toolCalls) {
            tool = this.parseTools(response);
            onToolCalls(response.toolCalls.name);
          }
          onProgress(response.content || '');
        }
      }
    } catch (err) {
      console.error('Read error:', err);
      onError(err);
    } finally {
      return {
        content,
        tool,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
      };
    }
  }
}
