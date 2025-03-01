import Debug from 'debug';
import {
  IChatContext,
  IChatRequestMessage,
  IChatRequestPayload,
} from 'intellichat/types';
import ChatBro from '../../providers/ChatBro';
import INextChatService from './INextCharService';
import OpenAIChatService from './OpenAIChatService';
import ChatBroReader from 'intellichat/readers/ChatBroReader';
import { urlJoin } from 'utils/util';

const debug = Debug('OMNI-OS:intellichat:ChatBroChatService');

export default class ChatBroChatService
  extends OpenAIChatService
  implements INextChatService
{
  constructor(context: IChatContext) {
    super(context);
    this.provider = ChatBro;
  }

  protected getReaderType() {
    return ChatBroReader;
  }

  protected async makePayload(
    messages: IChatRequestMessage[]
  ): Promise<IChatRequestPayload> {
    const payload: IChatRequestPayload = {
      model: this.getModelName(),
      messages: await this.makeMessages(messages),
      temperature: this.context.getTemperature(),
      stream: true,
    };
    if (this.context.getMaxTokens()) {
      payload.max_tokens = this.context.getMaxTokens();
    }
    debug('payload', payload);
    return payload;
  }

  protected async makeRequest(
    messages: IChatRequestMessage[]
  ): Promise<Response> {
    const payload = await this.makePayload(messages);
    debug('About to make a request, payload:\r\n', payload);
    const { base, key } = this.apiSettings;
    const url = urlJoin(`/v1/open/azure/chat`, base);
    const postResp = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify(payload),
    });
    const data: any = await postResp.json();
    const response = await fetch(
      `${base}/v1/open/azure/stream/chat/${data.key}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
        },
        signal: this.abortController.signal,
      }
    );
    return response;
  }
}
