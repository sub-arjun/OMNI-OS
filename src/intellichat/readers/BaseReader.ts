/**
 * BaseReader provides base functionality for reading and parsing streaming chat responses.
 * It handles stream decoding and content aggregation, while leaving specific message
 * parsing logic to child classes.
 */
import { IChatResponseMessage } from 'intellichat/types';
import { merge } from 'lodash';
import IChatReader, { IReadResult, ITool } from './IChatReader';
import Debug from 'debug';

const debug = Debug('OMNI-OS:intellichat:BaseReader');

export default abstract class BaseReader implements IChatReader {
  protected streamReader: ReadableStreamDefaultReader<Uint8Array>;

  constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.streamReader = reader;
  }

  /**
   * Parse tool calls from a response message.
   * Base implementation looks for tool_calls array and returns the first tool call if found.
   * Override this method for different tool call formats.
   */
  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (!respMsg.toolCalls || respMsg.toolCalls.length === 0) {
      return null;
    }
    const toolCall = respMsg.toolCalls[0];
    return {
      id: toolCall.id || '',
      name: toolCall.function?.name || '',
      args: toolCall.function?.arguments || '',
    };
  }

  /**
   * Parse tool arguments from a response message.
   * Base implementation assumes arguments are JSON strings that can be concatenated.
   * Override this method for different argument formats.
   */
  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    if (!respMsg.toolCalls || respMsg.toolCalls.length === 0) {
      return null;
    }

    const toolCall = respMsg.toolCalls[0];
    return {
      index: 0, // Default to first argument position
      args: toolCall.function?.arguments || '',
    };
  }

  /**
   * Parse a raw chunk into a structured message.
   * Base implementation assumes chunks are JSON strings.
   * Override this method for different message formats.
   */
  protected parseReply(chunk: string): IChatResponseMessage {
    try {
      return JSON.parse(chunk);
    } catch (e) {
      // If parsing fails, treat the chunk as plain text content
      return {
        content: chunk,
        toolCalls: [],
        inputTokens: 0,
        outputTokens: chunk.length / 4, // Rough estimate
      };
    }
  }

  /**
   * Process a chunk of data and determine if it completes a message.
   * Base implementation treats each chunk as a complete message.
   * Override this method for streaming or multi-part messages.
   *
   * Different providers have different streaming formats:
   * - Anthropic: Each chunk is a complete JSON message with different types
   * - OpenAI: Each chunk is a complete JSON message with choices[0].delta
   * - Fire: Raw text chunks that don't need JSON parsing
   *
   * Some providers may split JSON messages across chunks, requiring combination
   * before parsing. Override shouldCombineChunks() and getCombinedChunk() to
   * implement custom combining logic.
   *
   * @param chunk The current chunk of data to process
   * @returns A complete message if one is ready, null otherwise
   */
  protected processChunk(chunk: string): IChatResponseMessage | null {
    if (!chunk || chunk.trim() === '') {
      return null;
    }

    try {
      // Check if this is a JSON-formatted chunk with token usage information
      const data = JSON.parse(chunk);
      
      // Handle OpenRouter/OpenAI format where token usage is in a usage field
      if (data.usage && (data.usage.prompt_tokens || data.usage.completion_tokens)) {
        debug(`Found token usage data in chunk: ${JSON.stringify(data.usage)}`);
        return {
          content: '',
          isEnd: true,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
        };
      }
    } catch (e) {
      // Not JSON or failed to parse, continue with normal processing
    }

    // Default implementation treats each chunk as a complete message
    // Subclasses should override this to handle their specific streaming format
    return this.parseReply(chunk);
  }

  /**
   * Determine if chunks should be combined before parsing.
   * Base implementation returns false.
   * Override this to enable chunk combining for providers that split messages.
   */
  private incompleteChunks: string[] = [];

  /**
   * Check if a chunk can be parsed as valid JSON.
   * Returns true if parsing fails, indicating chunks need to be combined.
   *
   * @param chunk The chunk to check
   */
  protected shouldCombineChunks(chunk: string): boolean {
    try {
      JSON.parse(chunk);
      return false;
    } catch (e) {
      return true;
    }
  }

  /**
   * Combine chunks until we have valid JSON or reach max attempts.
   * Returns the combined chunk and whether it forms valid JSON.
   *
   * @param chunk Current chunk to process
   */
  protected getCombinedChunk(chunk: string): {
    combinedChunk: string;
    isComplete: boolean;
  } {
    this.incompleteChunks.push(chunk);

    // Keep only last 5 chunks
    if (this.incompleteChunks.length > 5) {
      this.incompleteChunks = this.incompleteChunks.slice(-5);
    }

    const combined = this.incompleteChunks.join('');

    try {
      JSON.parse(combined);
      // Clear chunks if we successfully parsed
      this.incompleteChunks = [];
      return {
        combinedChunk: combined,
        isComplete: true,
      };
    } catch (e) {
      return {
        combinedChunk: combined,
        isComplete: false,
      };
    }
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
    const state = {
      content: '',
      reasoning: '',
      inputTokens: 0,
      outputTokens: 0,
      currentTool: null as any,
      toolArguments: [] as string[],
      messageIndex: 0,
    };

    try {
      await this.processStreamData(decoder, state, { onProgress, onToolCalls });

      // Finalize tool arguments if a tool was being processed
      if (state.currentTool) {
        state.currentTool.args = this.finalizeToolArguments(
          state.toolArguments,
        );
      }
      return {
        content: state.content,
        reasoning: state.reasoning,
        tool: state.currentTool,
        inputTokens: state.inputTokens,
        outputTokens: state.outputTokens,
      };
    } catch (error) {
      console.error('Stream reading error:', error);
      onError(error);
      return {
        content: state.content,
        reasoning: state.reasoning,
        tool: state.currentTool,
        inputTokens: state.inputTokens,
        outputTokens: state.outputTokens,
      };
    }
  }

  private async processStreamData(
    decoder: TextDecoder,
    state: {
      content: string;
      reasoning: string;
      inputTokens: number;
      outputTokens: number;
      currentTool: any;
      toolArguments: string[];
      messageIndex: number;
    },
    callbacks: {
      onProgress: (chunk: string, reasoning?: string) => void;
      onToolCalls: (toolCalls: any) => void;
    },
  ): Promise<void> {
    let isStreamDone = false;

    while (!isStreamDone) {
      const { value, done } = await this.streamReader.read();
      if (done) break;

      const decodedValue = decoder.decode(value);
      const lines = this.splitIntoLines(decodedValue);

      for (const line of lines) {
        const chunks = this.extractDataChunks(line);

        for (const chunk of chunks) {
          if (chunk === '[DONE]') {
            isStreamDone = true;
            break;
          }

          // Handle chunk combining if needed
          const shouldCombine = this.shouldCombineChunks(chunk);
          const { combinedChunk, isComplete } = shouldCombine
            ? this.getCombinedChunk(chunk)
            : { combinedChunk: chunk, isComplete: true };

          // Only process the chunk if we have a complete message
          if (isComplete) {
            const completeMessage = this.processChunk(combinedChunk);
            if (completeMessage) {
              await this.processResponse(completeMessage, state, callbacks);
            }
          }
        }
      }
    }
  }

  private splitIntoLines(value: string): string[] {
    return value
      .split('\n')
      .filter((line) => !line.includes('event:'))
      .map((line) => line.trim())
      .filter((line) => line !== '');
  }

  private extractDataChunks(line: string): string[] {
    return line
      .split('data:')
      .filter((chunk) => chunk !== '')
      .map((chunk) => chunk.trim());
  }

  private async processResponse(
    response: IChatResponseMessage,
    state: {
      content: string;
      reasoning: string;
      inputTokens: number;
      outputTokens: number;
      currentTool: any;
      toolArguments: string[];
      messageIndex: number;
    },
    callbacks: {
      onProgress: (chunk: string) => void;
      onToolCalls: (toolCalls: any) => void;
    },
  ): Promise<void> {
    if (response.content === null && !response.toolCalls) return;

    if (state.currentTool === null) {
      const tool = this.parseTools(response);
      if (tool) {
        state.currentTool = tool;
        callbacks.onToolCalls(tool.name);
      } else {
        state.currentTool = null;
        callbacks.onToolCalls(null);
      }
    }
    if (state.currentTool) {
      this.processToolArguments(response, state);
    } else {
      this.processContentResponse(response, state, callbacks);
    }

    this.updateTokenCounts(response, state);
    state.messageIndex++;
  }

  private processToolArguments(
    response: IChatResponseMessage,
    state: {
      toolArguments: string[];
      messageIndex: number;
    },
  ): void {
    const argument = this.parseToolArgs(response);
    if (argument) {
      const { index } = argument;
      const arg =
        typeof argument.args === 'string'
          ? argument.args
          : JSON.stringify(argument.args);
      if (!state.toolArguments[index]) {
        state.toolArguments[index] = '';
      }
      state.toolArguments[index] += arg;
    }
  }

  private processContentResponse(
    response: IChatResponseMessage,
    state: { content: string; reasoning: string },
    callbacks: { onProgress: (chunk: string, reasoning?: string) => void },
  ): void {
    state.content += response.content;
    state.reasoning += response.reasoning || '';
    callbacks.onProgress(response.content || '', response.reasoning || '');
  }

  private updateTokenCounts(
    response: IChatResponseMessage,
    state: { inputTokens: number; outputTokens: number },
  ): void {
    if (response.outputTokens) {
      state.outputTokens += response.outputTokens;
    }
    if (response.inputTokens) {
      state.inputTokens = response.inputTokens;
    }
  }

  private finalizeToolArguments(toolArguments: string[]): any {
    const parsedArgs = toolArguments.map((arg) => JSON.parse(arg));
    return merge({}, ...parsedArgs);
  }
}
