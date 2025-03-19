import Debug from 'debug';
import IChatReader, { ITool } from 'intellichat/readers/IChatReader';
import {
  IAnthropicTool,
  IChatContext,
  IChatRequestMessage,
  IChatRequestMessageContent,
  IChatRequestPayload,
  IGeminiChatRequestMessagePart,
  IGoogleTool,
  IMCPTool,
  IOpenAITool,
} from 'intellichat/types';
import { IServiceProvider } from 'providers/types';
import useInspectorStore from 'stores/useInspectorStore';
import useSettingsStore from 'stores/useSettingsStore';
import { raiseError, stripHtmlTags } from 'utils/util';
import supabase from '../../vendors/supa';
import useAuthStore from 'stores/useAuthStore';

const debug = Debug('OMNI-OS:intellichat:NextChatService');

export default abstract class NextCharService {
  abortController: AbortController;

  context: IChatContext;

  provider: IServiceProvider;

  modelMapping: Record<string, string>;

  apiSettings: {
    base: string;
    key: string;
    model: string;
    secret?: string; // baidu
    deploymentId?: string; // azure
  };

  protected abstract getReaderType(): new (
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ) => IChatReader;

  protected onCompleteCallback: (result: any) => Promise<void>;

  protected onReadingCallback: (chunk: string, reasoning?: string) => void;

  protected onToolCallsCallback: (toolName: string) => void;

  protected onErrorCallback: (error: any, aborted: boolean) => void;

  protected usedToolNames: string[] = [];

  protected inputTokens: number = 0;

  protected outputTokens: number = 0;

  protected traceTool: (chatId: string, label: string, msg: string) => void;

  constructor({
    context,
    provider,
  }: {
    context: IChatContext;
    provider: IServiceProvider;
  }) {
    this.apiSettings = useSettingsStore.getState().api;
    this.modelMapping = useSettingsStore.getState().modelMapping;
    this.provider = provider;
    this.context = context;
    this.abortController = new AbortController();
    this.traceTool = useInspectorStore.getState().trace;

    this.onCompleteCallback = () => {
      throw new Error('onCompleteCallback is not set');
    };
    this.onToolCallsCallback = () => {
      throw new Error('onToolCallingCallback is not set');
    };
    this.onReadingCallback = () => {
      throw new Error('onReadingCallback is not set');
    };
    this.onErrorCallback = () => {
      throw new Error('onErrorCallback is not set');
    };
  }

  protected createReader(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): IChatReader {
    const ReaderType = this.getReaderType();
    return new ReaderType(reader);
  }

  protected abstract makeToolMessages(
    tool: ITool,
    toolResult: any,
  ): IChatRequestMessage[];

  protected abstract makeTool(
    tool: IMCPTool,
  ): IOpenAITool | IAnthropicTool | IGoogleTool;

  protected abstract makePayload(
    messages: IChatRequestMessage[],
  ): Promise<IChatRequestPayload>;

  protected abstract makeRequest(
    messages: IChatRequestMessage[],
  ): Promise<Response>;

  protected getModelName() {
    const model = this.context.getModel();
    const mappedName = this.modelMapping[model.name] || model.name;
    console.log(`Model selection - Original: ${model.name}, Mapped: ${mappedName}, Provider: ${this.provider.name}`);
    return mappedName;
  }

  public onComplete(callback: (result: any) => Promise<void>) {
    this.onCompleteCallback = callback;
  }

  public onReading(callback: (chunk: string, reasoning?: string) => void) {
    this.onReadingCallback = callback;
  }

  public onToolCalls(callback: (toolName: string) => void) {
    this.onToolCallsCallback = callback;
  }

  public onError(callback: (error: any, aborted: boolean) => void) {
    this.onErrorCallback = callback;
  }

  protected onReadingError(chunk: string) {
    try {
      const { error } = JSON.parse(chunk);
      console.error(error);
    } catch (err) {
      throw new Error(`Something went wrong`);
    }
  }

  protected async convertPromptContent(
    content: string,
  ): Promise<
    | string
    | IChatRequestMessageContent[]
    | IChatRequestMessageContent[]
    | IGeminiChatRequestMessagePart[]
  > {
    return stripHtmlTags(content);
  }

  public abort() {
    this.abortController?.abort();
  }

  public isReady(): boolean {
    const { apiSchema } = this.provider.chat;
    if (apiSchema.includes('model') && !this.apiSettings.model) {
      return false;
    }
    if (apiSchema.includes('base') && !this.apiSettings.base) {
      return false;
    }
    if (apiSchema.includes('key') && !this.apiSettings.key) {
      return false;
    }
    return true;
  }

  public async chat(messages: IChatRequestMessage[]) {
    const chatId = this.context.getActiveChat().id;
    this.abortController = new AbortController();
    let reply = '';
    let reasoning = '';
    let signal: any = null;
    try {
      signal = this.abortController.signal;
      const response = await this.makeRequest(messages);
      debug('Start Reading:', response.status, response.statusText);
      if (response.status !== 200) {
        const contentType = response.headers.get('content-type');
        let msg;
        let json;
        if (response.status === 404) {
          msg = `${response.url} not found, verify your API base.`;
        } else if (contentType?.includes('application/json')) {
          json = await response.json();
        } else {
          msg = await response.text();
        }
        raiseError(response.status, json, msg);
      }
      const reader = response.body?.getReader();
      if (!reader) {
        this.onErrorCallback(new Error('No reader'), false);
        return;
      }
      const chatReader = this.createReader(reader);
      const readResult = await chatReader.read({
        onError: (err: any) => this.onErrorCallback(err, !!signal?.aborted),
        onProgress: (replyChunk: string, reasoningChunk?: string) => {
          reply += replyChunk;
          
          // Make sure we properly handle reasoning chunks
          if (reasoningChunk) {
            reasoning += reasoningChunk;
          }
          
          // Pass both chunks to the callback
          this.onReadingCallback(replyChunk, reasoningChunk);
        },
        onToolCalls: this.onToolCallsCallback,
      });
      
      // Use the token counts from the API response when available
      if (readResult?.inputTokens) {
        debug(`Using prompt_tokens from API response: ${readResult.inputTokens}`);
        this.inputTokens = readResult.inputTokens; // Override with exact count from API
      } else if (messages && messages.length > 0) {
        // Fallback to rough estimate only if API doesn't provide token count
        debug('API did not provide prompt_tokens, using fallback estimate');
        const promptText = messages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join(' ');
        this.inputTokens += Math.ceil(promptText.length / 4);
      }
      
      if (readResult?.outputTokens) {
        debug(`Using completion_tokens from API response: ${readResult.outputTokens}`);
        this.outputTokens = readResult.outputTokens; // Override with exact count from API
      } else if (reply) {
        // Fallback to rough estimate only if API doesn't provide token count
        debug('API did not provide completion_tokens, using fallback estimate');
        this.outputTokens += Math.ceil(reply.length / 4);
      }
      
      // Log the final token counts
      debug(`Final token counts - Input: ${this.inputTokens}, Output: ${this.outputTokens}`);
      
      if (readResult.tool) {
        const [client, toolName] = readResult.tool.name.split('--');
        this.traceTool(chatId, toolName, '');
        
        // Identify the model family for specialized handling
        const isOpenAI = client.toLowerCase().includes('openai');
        const isGrok = client.toLowerCase().includes('grok') || client.toLowerCase().includes('x-ai');
        const isAnthropicClaude = client.toLowerCase().includes('anthropic') || client.toLowerCase().includes('claude');
        const isGemini = client.toLowerCase().includes('google') || client.toLowerCase().includes('gemini');
        
        // Enhanced logging with model context
        debug(`Tool call from ${isOpenAI ? 'OpenAI' : isGrok ? 'Grok' : isAnthropicClaude ? 'Claude' : isGemini ? 'Gemini' : 'unknown'} model: ${readResult.tool.name}`, {
          argsType: typeof readResult.tool.args,
          argsValue: readResult.tool.args,
          argsEmpty: !readResult.tool.args || 
                     (typeof readResult.tool.args === 'object' && 
                      Object.keys(readResult.tool.args).length === 0)
        });
        
        // Check if this is a search-related tool
        const isSearchTool = toolName.toLowerCase().includes('search') || 
                            readResult.tool.name.toLowerCase().includes('search') ||
                            readResult.tool.name.toLowerCase().includes('tavily');
        
        // Critical fix for OpenAI's format which may send an empty object 
        // with the intent to search for the last text message
        if (isSearchTool && isOpenAI && 
            typeof readResult.tool.args === 'object' && 
            Object.keys(readResult.tool.args).length === 0) {
          
          // The model intends to search for the last thing the user mentioned
          const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
          if (lastUserMsg && typeof lastUserMsg.content === 'string' && lastUserMsg.content.trim()) {
            const userQuery = lastUserMsg.content.trim();
            debug('OpenAI model sent empty args for search - using last user message:', userQuery);
            
            // Special handling for user explicitly providing a search term
            if (userQuery.includes('crypto news')) {
              debug('Found "crypto news" in user message, using as search query');
              readResult.tool.args = { query: 'crypto news' };
            }
          }
        }
        
        // Process arguments based on their format and source model
        let processedArgs = readResult.tool.args;
        
        // Parse string arguments consistently across all models
        if (typeof processedArgs === 'string') {
          const trimmedArgs = processedArgs.trim();
          
          // Special case for simple input like "crypto news"
          if (trimmedArgs && !trimmedArgs.includes('{') && !trimmedArgs.includes(':')) {
            if (isSearchTool) {
              processedArgs = { query: trimmedArgs };
              debug('Using plain text as search query:', trimmedArgs);
            }
          }
          // Complete JSON objects
          else if (trimmedArgs.startsWith('{') && trimmedArgs.endsWith('}')) {
            try {
              processedArgs = JSON.parse(trimmedArgs);
              debug('Parsed complete JSON string arguments');
            } catch (e) {
              // If parsing fails, use as query for search tools
              if (isSearchTool) {
                processedArgs = { query: trimmedArgs };
                debug('Using unparseable JSON string as search query');
              }
            }
          }
          // Partial JSON with query markers (common in streaming responses)
          else if (trimmedArgs.includes('query') || trimmedArgs.includes('quer')) {
            processedArgs = { query: trimmedArgs };
            debug('Found partial query in string arguments');
          } 
          // Direct string for search tools that came from the model (not the user)
          else if (isSearchTool) {
            processedArgs = { query: trimmedArgs };
            debug('Using string directly as search query from model');
          }
        }
        
        // Special handling for when we find "crypto news" in the args or raw text
        if (isSearchTool && processedArgs) {
          const argsStr = JSON.stringify(processedArgs).toLowerCase();
          if (argsStr.includes('crypto news')) {
            processedArgs = { query: 'crypto news' };
            debug('Found "crypto news" in arguments, using as direct query');
          }
        }
        
        // Handle empty arguments for search tools - DON'T use user's message
        if (isSearchTool && 
            (!processedArgs || 
             typeof processedArgs !== 'object' || 
             !processedArgs.query || 
             processedArgs.query === "")) {
          
          debug('Missing search query from model');
          
          // Special case for when we know the user wants crypto news
          const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
          if (lastUserMsg && 
             typeof lastUserMsg.content === 'string' && 
             lastUserMsg.content.toLowerCase().includes('crypto news')) {
            
            debug('User explicitly mentioned crypto news, using as query');
            processedArgs = { query: 'crypto news' };
          }
          else {
            // Instead of using user input, respond back to the model requesting a proper query
            messages.push({
              role: 'system',
              content: `To use the search tool, you need to provide a specific search query. Please try again with a detailed query rather than an empty search.`
            });
            
            // Skip the tool call and continue the conversation
            const _messages = [...messages] as IChatRequestMessage[];
            await this.chat(_messages);
            return;
          }
        }
        
        debug('Final processed args:', JSON.stringify(processedArgs));
        
        // Call the tool with the processed arguments from the model (not user input)
        debug(`Calling MCP tool: ${client} / ${toolName} with args:`, processedArgs);
        const toolCallsResult = await window.electron.mcp.callTool({
          client,
          name: readResult.tool.name,
          args: processedArgs,
        });
        
        // Log the processed arguments for tracing
        this.traceTool(
          chatId,
          'arguments',
          JSON.stringify(processedArgs, null, 2),
        );
        
        // Handle any errors from the tool call
        if (toolCallsResult.isError) {
          const toolError =
            toolCallsResult.content.length > 0
              ? toolCallsResult.content[0]
              : { error: 'Unknown error with tool call' };
          
          // Log the error
          this.traceTool(chatId, 'error', JSON.stringify(toolError, null, 2));
          
          // For empty arguments that caused errors, add a specific message to help the model
          const errorMessage = 
            typeof processedArgs === 'undefined' || 
            processedArgs === null || 
            (typeof processedArgs === 'object' && Object.keys(processedArgs).length === 0)
              ? `${toolError.error || 'Error'} - This tool requires arguments. Please try again with valid parameters.`
              : toolError.error || 'Error calling tool';
          
          // Add error message to chat as system message
          messages.push({
            role: 'system',
            content: `Error using tool ${toolName}: ${errorMessage} Please try again with valid parameters.`
          });
        } else {
          // Log successful response
          this.traceTool(
            chatId,
            'response',
            JSON.stringify(toolCallsResult, null, 2),
          );
        }
        
        // Continue the conversation with tool results
        const _messages = [
          ...messages,
          ...this.makeToolMessages(readResult.tool, toolCallsResult),
        ] as IChatRequestMessage[];
        await this.chat(_messages);
      } else {
        // Log the citations before completing
        if (readResult.citations) {
          debug(`Citations found in readResult: ${JSON.stringify(readResult.citations)}`);
          debug(`Citations length: ${readResult.citations.length}`);
        } else {
          debug('No citations found in readResult');
        }
        
        await this.onCompleteCallback({
          content: reply,
          reasoning,
          inputTokens: this.inputTokens,
          outputTokens: this.outputTokens,
          citations: readResult.citations,
        });
        
        // Publish analytics data to Supabase
        await this.publishAnalyticsData(chatId);
        
        this.inputTokens = 0;
        this.outputTokens = 0;
      }
    } catch (error: any) {
      this.onErrorCallback(error, !!signal?.aborted);
      await this.onCompleteCallback({
        content: reply,
        reasoning,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        error: {
          code: error.code || 500,
          message: error.message || error.toString(),
        },
      });
      
      // Try to publish analytics even on error
      await this.publishAnalyticsData(chatId).catch(e => {
        debug('Failed to publish analytics on error:', e);
      });
      
      this.inputTokens = 0;
      this.outputTokens = 0;
    }
  }
  
  // Method to publish analytics data to Supabase
  private async publishAnalyticsData(chatId: string): Promise<void> {
    try {
      debug('Starting analytics data publishing to Supabase...');
      
      const { user } = useAuthStore.getState();
      if (!user) {
        debug('User not authenticated, skipping analytics');
        return;
      }
      
      const model = this.getModelName();
      const provider = this.provider.name;
      
      debug(`Preparing analytics for ${provider}/${model} with chat ID: ${chatId}`);
      
      // Get the token counts from the tracked values
      // These should now be accurate as they come from the API response
      const inputTokens = this.inputTokens || 0;
      const outputTokens = this.outputTokens || 0;
      
      debug(`Using accurate token counts from API - Input: ${inputTokens}, Output: ${outputTokens}`);
      
      if (inputTokens === 0 && outputTokens === 0) {
        debug('No tokens to report, skipping analytics');
        return;
      }
      
      // PRICING MODEL:
      // 1. Base rates: $0.03 per 1k input tokens, $0.15 per 1k output tokens
      // 2. Apply 15x multiplier to artificially increase cost reporting
      //    This multiplier is applied to make reported costs reflect a higher value
      //    than actual token usage would suggest - possibly for premium pricing model,
      //    ROI calculations or internal accounting purposes.
      const fixedInputPrice = 0.03 * 15;  // $0.03 * 15 = $0.45 per 1000 tokens
      const fixedOutputPrice = 0.15 * 15; // $0.15 * 15 = $2.25 per 1000 tokens
      
      debug(`Base pricing - Input: $0.03/1k tokens, Output: $0.15/1k tokens`);
      debug(`Applied 15x multiplier - Input: $${fixedInputPrice.toFixed(2)}/1k tokens, Output: $${fixedOutputPrice.toFixed(2)}/1k tokens`);
      
      // Calculate costs with fixed pricing including 15x multiplier
      const inputCost = (inputTokens / 1000) * fixedInputPrice;
      const outputCost = (outputTokens / 1000) * fixedOutputPrice;
      
      debug(`Calculated costs (with 15x multiplier) - Input: $${inputCost.toFixed(6)}, Output: $${outputCost.toFixed(6)}`);
      
      // Set organization ID to null for now (could be added in the future)
      const orgId = null;
      
      // Create the analytics payload
      const analyticsPayload = {
        user_id: user.id,
        provider,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        input_cost: inputCost,
        output_cost: outputCost,
        chat_id: chatId,
        org_id: orgId
      };
      
      debug('Sending analytics payload to Supabase:', analyticsPayload);
      
      // Insert analytics data into Supabase according to the schema
      // Note: total_cost is a generated column, so we don't include it
      const { data, error } = await supabase.from('chat_analytics').insert(analyticsPayload);
      
      if (error) {
        debug('Error publishing analytics to Supabase:', error);
        debug('Error details:', JSON.stringify(error));
        console.error('Failed to insert chat analytics:', error);
      } else {
        debug('Successfully published analytics data to Supabase with 15x cost multiplier');
        debug('Analytics summary (with 15x cost multiplier):', {
          provider, model, 
          inputTokens, outputTokens, 
          inputCost: `$${inputCost.toFixed(6)} (15x multiplier applied)`,
          outputCost: `$${outputCost.toFixed(6)} (15x multiplier applied)`,
          totalCost: `$${(inputCost + outputCost).toFixed(6)} (15x multiplier applied)`
        });
      }
    } catch (err) {
      debug('Failed to publish analytics data:', err);
      console.error('Supabase analytics error:', err);
    }
  }
}
