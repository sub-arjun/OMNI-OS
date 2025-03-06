import Debug from 'debug';
import {
  IChatContext,
  IChatRequestMessage,
  IChatRequestPayload,
  IChatMessage,
  IChatRequestMessageContent,
  IAnthropicTool,
  IOpenAITool,
  IMCPTool,
  IGoogleTool,
} from 'intellichat/types';
import { isBlank } from 'utils/validators';
import { splitByImg, stripHtmlTags } from 'utils/util';
import OpenAIReader from 'intellichat/readers/OpenAIReader';
import { ITool } from 'intellichat/readers/IChatReader';
import NextChatService from './NextChatService';
import INextChatService from './INextCharService';
import OpenAI from '../../providers/OpenAI';
import { urlJoin } from 'utils/util';
import { captureException } from 'renderer/logging';

const debug = Debug('OMNI-OS:intellichat:OpenAIChatService');

export default class OpenAIChatService
  extends NextChatService
  implements INextChatService
{
  constructor(context: IChatContext) {
    super({
      context,
      provider: OpenAI,
    });
  }

  protected getReaderType() {
    return OpenAIReader;
  }

  protected async convertPromptContent(
    content: string,
  ): Promise<string | IChatRequestMessageContent[]> {
    if (this.context.getModel().vision?.enabled) {
      const items = splitByImg(content);
      const result: IChatRequestMessageContent[] = [];
      items.forEach((item: any) => {
        if (item.type === 'image') {
          result.push({
            type: 'image_url',
            image_url: {
              url: item.data,
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
      });
      return result;
    }
    return stripHtmlTags(content);
  }

  protected async makeMessages(
    messages: IChatRequestMessage[],
  ): Promise<IChatRequestMessage[]> {
    const result = [];
    const systemMessage = this.context.getSystemMessage();
    let sysRole = 'system';
    if (['o1', 'o3'].some((prefix) => this.getModelName().startsWith(prefix))) {
      sysRole = 'developer';
    }
    if (!isBlank(systemMessage)) {
      result.push({
        role: sysRole,
        content: systemMessage,
      });
    }
    this.context.getCtxMessages().forEach((msg: IChatMessage) => {
      result.push({
        role: 'user',
        content: msg.prompt,
      });
      result.push({
        role: 'assistant',
        content: msg.reply,
      });
    });
    for (const msg of messages) {
      if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          content: JSON.stringify(msg.content),
          name: msg.name,
          tool_call_id: msg.tool_call_id,
        });
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        result.push(msg);
      } else {
        const { content } = msg;
        if (typeof content === 'string') {
          result.push({
            role: 'user',
            content: await this.convertPromptContent(content),
          });
        } else {
          result.push({
            role: 'user',
            content,
          });
        }
      }
    }
    return result as IChatRequestMessage[];
  }

  protected makeTool(
    tool: IMCPTool,
  ): IOpenAITool | IAnthropicTool | IGoogleTool {
    // Get server information if available - cast to any since these properties are added at runtime
    const serverName = (tool as any)._serverName || (tool as any)._clientKey || '';
    
    // Create a clear name that includes server information
    const enhancedName = serverName ? 
      `${tool.name} (from ${serverName})` : 
      tool.name;
    
    // Enhance the description with server information
    const enhancedDescription = serverName ? 
      `[FROM SERVER: ${serverName}] ${tool.description}` : 
      tool.description;
    
    return {
      type: 'function',
      function: {
        // Keep the original name for technical operation
        name: tool.name,
        // Use enhanced description with server info prominently displayed
        description: enhancedDescription.substring(0, 1000), // some models have a limit on the description length
        parameters: {
          type: tool.inputSchema.type,
          properties: {
            // Add server info as an additional parameter (read-only)
            ...(serverName ? {
              _serverInfo: {
                type: "object",
                description: `Information about the server providing this tool: ${serverName}`,
                properties: {
                  name: {
                    type: "string",
                    description: `Server name: ${serverName}`
                  }
                },
                readOnly: true
              }
            } : {}),
            // Include the original properties
            ...tool.inputSchema.properties || {},
          },
          required: tool.inputSchema.required || [],
          additionalProperties: tool.inputSchema.additionalProperties || false,
        },
      },
    };
  }

  protected makeToolMessages(
    tool: ITool,
    toolResult: any,
  ): IChatRequestMessage[] {
    // Extract server info if available in the result
    const serverInfo = toolResult?.serverInfo || 
                      (toolResult?.content && typeof toolResult.content === 'object' && toolResult.content._serverInfo) || 
                      (tool.args && tool.args._serverInfo);
    
    // Prepare the content with server info if available
    let content = typeof toolResult === 'string' ? toolResult : toolResult.content;
    
    // If server info is available and content is an object, add it directly
    if (serverInfo && typeof content === 'object') {
      content = {
        ...content,
        _serverInfo: serverInfo
      };
    } 
    // If server info is available and content is a string, add a prefix
    else if (serverInfo && typeof content === 'string') {
      content = `[From server: ${serverInfo.name}] ${content}`;
    }
    
    return [
      {
        role: 'assistant',
        tool_calls: [
          {
            id: tool.id,
            type: 'function',
            function: {
              arguments: JSON.stringify(tool.args),
              name: tool.name,
            },
          },
        ],
      },
      {
        role: 'tool',
        name: tool.name,
        content: content,
        tool_call_id: tool.id,
      },
    ];
  }

  protected async makePayload(
    message: IChatRequestMessage[],
  ): Promise<IChatRequestPayload> {
    const modelName = this.getModelName();
    console.log(`OpenAIChatService.makePayload - Model name: ${modelName}, Provider: ${this.provider.name}`);
    
    const payload: IChatRequestPayload = {
      model: modelName,
      messages: await this.makeMessages(message),
      temperature: this.context.getTemperature(),
      stream: true,
    };
    
    console.log(`OpenAIChatService.makePayload - Initial payload model: ${payload.model}`);
    
    if (this.context.isToolEnabled()) {
      const tools = await window.electron.mcp.listTools();
      if (tools) {
        const _tools = tools
          .filter((tool: any) => !this.usedToolNames.includes(tool.name))
          .map((tool: any) => {
            const toolObj = this.makeTool(tool);
            // Add server name to the tool description if available
            if (tool._serverName && 'function' in toolObj) {
              toolObj.function.description = `[From server: ${tool._serverName}] ${toolObj.function.description}`;
            }
            return toolObj;
          });
        if (_tools.length > 0) {
          payload.tools = _tools;
          payload.tool_choice = 'auto';
        }
      }
    }
    if (this.context.getMaxTokens()) {
      /**
       * max_tokens is deprecated, use max_completion_tokens instead for new models
       */
      if (modelName.startsWith('o1') || modelName.startsWith('o3')) {
        payload.max_completion_tokens = this.context.getMaxTokens();
        payload.temperature = 1; // o1 and o3 models require temperature to be 1
      } else {
        payload.max_tokens = this.context.getMaxTokens();
      }
    }
    return payload;
  }

  protected async makeRequest(
    messages: IChatRequestMessage[],
  ): Promise<Response> {
    const payload = await this.makePayload(messages);
    debug('About to make a request, payload:\r\n', payload);
    const { base, key } = this.apiSettings;
    const url = urlJoin('/chat/completions', base);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
      signal: this.abortController.signal,
    });
    return response;
  }
}
