import Debug from 'debug';
import { create } from 'zustand';
import { typeid } from 'typeid-js';
import { produce } from 'immer';
import {
  isNil,
  isNull,
  isNumber,
  isPlainObject,
  isString,
  isUndefined,
  pick,
} from 'lodash';
import {
  DEFAULT_MAX_TOKENS,
  NUM_CTX_MESSAGES,
  tempChatId,
} from 'consts';
import { captureException } from '../renderer/logging';
import { date2unix } from 'utils/util';
import { isBlank, isNotBlank } from 'utils/validators';
import useSettingsStore from './useSettingsStore';
import { IChat, IChatMessage, IPrompt, IStage } from 'intellichat/types';
import { isValidTemperature } from 'intellichat/validators';
import { getProvider } from 'providers';

const debug = Debug('OMNI-OS:stores:useChatStore');

let defaultTempStage = {
  model: '',
  systemMessage: '',
  prompt: null,
  input: '',
  maxTokens: DEFAULT_MAX_TOKENS,
  maxCtxMessages: NUM_CTX_MESSAGES,
};
let tempStage = window.electron.store.get('stage', defaultTempStage);
if (!isPlainObject(tempStage)) {
  tempStage = defaultTempStage;
} else {
  tempStage = pick(tempStage, Object.keys(defaultTempStage));
  console.log('tempStage', tempStage);
}
export interface IChatStore {
  chats: IChat[];
  chat: {
    id: string;
  } & Partial<IChat>;
  messages: IChatMessage[];
  keywords: { [key: string]: string };
  states: {
    [key: string]: {
      loading: boolean;
      runningTool: string;
    };
  };
  tempStage: Partial<IStage>;
  updateStates: (
    chatId: string,
    states: { loading?: boolean; runningTool?: string | null },
  ) => void;
  getKeyword: (chatId: string) => string;
  setKeyword: (chatId: string, keyword: string) => void;
  // chat
  initChat: (chat: Partial<IChat>) => IChat;
  editChat: (chat: Partial<IChat>) => IChat;
  createChat: (
    chat: Partial<IChat>,
    beforeSetCallback?: (chat: IChat) => Promise<void>,
  ) => Promise<IChat>;
  updateChat: (chat: { id: string } & Partial<IChat>) => Promise<boolean>;
  deleteChat: () => Promise<boolean>;
  fetchChat: (limit?: number) => Promise<IChat[]>;
  getChat: (id: string) => Promise<IChat>;
  // message
  createMessage: (message: Partial<IChatMessage>) => Promise<IChatMessage>;
  appendReply: (chatId: string, reply: string, reasoning:string) => void;
  updateMessage: (
    message: { id: string } & Partial<IChatMessage>,
  ) => Promise<boolean>;
  bookmarkMessage: (id: string, bookmarkId: string | null) => void;
  deleteMessage: (id: string) => Promise<boolean>;
  getCurState: () => { loading: boolean; runningTool: string };
  fetchMessages: ({
    chatId,
    limit,
    offset,
    keyword,
  }: {
    chatId: string;
    limit?: number;
    offset?: number;
    keyword?: string;
  }) => Promise<IChatMessage[]>;
  editStage: (chatId: string, stage: Partial<IStage>) => void;
  deleteStage: (chatId: string) => void;
}

const useChatStore = create<IChatStore>((set, get) => ({
  keywords: {},
  chats: [],
  chat: { id: tempChatId, ...tempStage },
  messages: [],
  states: {},
  // only for temp chat
  tempStage,
  updateStates: (
    chatId: string,
    states: { loading?: boolean; runningTool?: string | null },
  ) => {
    set(
      produce((state: IChatStore) => {
        state.states[chatId] = Object.assign(
          state.states[chatId] || {},
          states,
        );
      }),
    );
  },
  getCurState: () => {
    const { chat, states } = get();
    return states[chat.id] || {};
  },
  getKeyword: (chatId: string) => {
    return get().keywords[chatId] || '';
  },
  setKeyword: (chatId: string, keyword: string) => {
    set(
      produce((state: IChatStore) => {
        state.keywords[chatId] = keyword;
      }),
    );
  },
  initChat: (chat: Partial<IChat>) => {
    const { api } = useSettingsStore.getState();
    const $chat = Object.assign(
      {
        model: api.model,
        temperature: getProvider(api.provider).chat.temperature.default,
        maxTokens: null,
        maxCtxMessages: NUM_CTX_MESSAGES,
        id: tempChatId,
      },
      get().tempStage,
      chat,
    ) as IChat;
    debug('Init a chat', $chat);
    $chat.input = chat.input || '';
    $chat.stream = true;
    set({ chat: $chat, messages: [] });
    return $chat;
  },
  editChat: (chat: Partial<IChat>) => {
    const { api } = useSettingsStore.getState();
    const $chat = { ...get().chat } as IChat;
    if (isString(chat.summary)) {
      $chat.summary = chat.summary as string;
    }
    if (isNotBlank(chat.model)) {
      $chat.model = chat.model as string;
    }
    if (!isNil(chat.systemMessage)) {
      $chat.systemMessage = chat.systemMessage as string;
    }
    if (isNumber(chat.maxCtxMessages) && chat.maxCtxMessages >= 0) {
      $chat.maxCtxMessages = chat.maxCtxMessages;
    }
    if (isValidTemperature(chat.temperature, api.provider)) {
      $chat.temperature = chat.temperature;
    }
    if (isNumber(chat.maxTokens) && chat.maxTokens > 0) {
      $chat.maxTokens = chat.maxTokens;
    }
    if (!isUndefined(chat.prompt)) {
      $chat.prompt = (chat.prompt as IPrompt) || null;
    }
    $chat.input = chat.input || '';
    $chat.stream = isNil(chat.stream) ? true : chat.stream;
    set(
      produce((state: IChatStore) => {
        state.chat = { ...state.chat, ...$chat };
      }),
    );
    return $chat;
  },
  createChat: async (
    chat: Partial<IChat>,
    beforeSetCallback?: (chat: IChat) => Promise<void>,
  ) => {
    const $chat = {
      ...get().chat,
      ...chat,
      id: typeid('chat').toString(),
      createdAt: date2unix(new Date()),
    } as IChat;
    debug('Create a chat ', $chat);
    let prompt = null;
    $chat.input = ''; // clear input
    try {
      prompt = $chat.prompt ? JSON.stringify($chat.prompt) : null;
    } catch (err: any) {
      captureException(err);
    }
    const ok = await window.electron.db.run(
      `INSERT INTO chats (id, summary, model, systemMessage, temperature, maxCtxMessages, maxTokens, stream, prompt, input, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)`,
      [
        $chat.id,
        $chat.summary,
        $chat.model || null,
        $chat.systemMessage || null,
        $chat.temperature || null,
        $chat.maxCtxMessages || null,
        $chat.maxTokens || null,
        1,
        prompt,
        $chat.input,
        $chat.createdAt,
      ],
    );
    if (!ok) {
      throw new Error('Write the chat into database failed');
    }
    if (beforeSetCallback) {
      await beforeSetCallback($chat);
    }
    set(
      produce((state: IChatStore) => {
        state.chat = $chat;
        state.chats = [$chat, ...state.chats];
        state.messages = [];
      }),
    );
    return $chat;
  },
  updateChat: async (chat: { id: string } & Partial<IChat>) => {
    console.log('updateChat', chat);
    const $chat = { id: chat.id } as IChat;
    const stats: string[] = [];
    const params: (string | number | null)[] = [];
    if (isNotBlank(chat.summary)) {
      stats.push('summary = ?');
      $chat.summary = chat.summary as string;
      params.push($chat.summary);
    }
    if (isNotBlank(chat.model)) {
      stats.push('model = ?');
      $chat.model = chat.model as string;
      params.push($chat.model);
    }
    if (!isNil(chat.systemMessage)) {
      stats.push('systemMessage = ?');
      $chat.systemMessage = chat.systemMessage as string;
      params.push($chat.systemMessage);
    }
    if (isNumber(chat.maxCtxMessages) && chat.maxCtxMessages >= 0) {
      stats.push('maxCtxMessages = ?');
      $chat.maxCtxMessages = chat.maxCtxMessages;
      params.push($chat.maxCtxMessages);
    }
    if (isNumber(chat.temperature) && chat.temperature >= 0) {
      stats.push('temperature = ?');
      $chat.temperature = chat.temperature;
      params.push($chat.temperature);
    }
    if (isNumber(chat.maxTokens) && chat.maxTokens > 0) {
      stats.push('maxTokens = ?');
      $chat.maxTokens = chat.maxTokens;
      params.push($chat.maxTokens);
    }
    if (!isNil(chat.context)) {
      stats.push('context = ?');
      chat.context = chat.context as string;
      params.push(chat.context);
    }
    if (!isNil(chat.stream)) {
      stats.push('stream = ?');
      $chat.stream = true;
      params.push(1);
    }
    if (!isUndefined(chat.input)) {
      $chat.input = chat.input as string;
      stats.push('input = ?');
      params.push($chat.input);
    }
    if (!isUndefined(chat.prompt)) {
      try {
        $chat.prompt = chat.prompt;
        stats.push('prompt = ?');
        params.push(
          chat.prompt ? (JSON.stringify(chat.prompt) as string) : null,
        );
      } catch (err: any) {
        captureException(err);
      }
    }
    if ($chat.id && stats.length) {
      params.push($chat.id);
      await window.electron.db.run(
        `UPDATE chats SET ${stats.join(', ')} WHERE id = ?`,
        params,
      );
      const updatedChat = { ...get().chat, ...$chat } as IChat;
      const updatedChats = get().chats.map((c: IChat) => {
        if (c.id === updatedChat.id) {
          return updatedChat;
        }
        return c;
      });
      set(
        produce((state: IChatStore) => {
          state.chat = updatedChat;
          state.chats = updatedChats;
        }),
      );
      debug('Update chat ', updatedChat);
      return true;
    }
    return false;
  },
  getChat: async (id: string) => {
    const chat = (await window.electron.db.get(
      'SELECT id, summary, model, systemMessage, maxTokens, temperature, context, maxCtxMessages, stream, prompt, input, createdAt FROM chats where id = ?',
      id,
    )) as IChat;
    if (chat) {
      try {
        chat.prompt = chat.prompt ? JSON.parse(chat.prompt as string) : null;
      } catch (err: any) {
        captureException(err);
      }
    }
    debug('Get chat:', chat);
    set({ chat });
    return chat;
  },
  fetchChat: async (limit: number = 100, offset = 0) => {
    const rows = (await window.electron.db.all(
      'SELECT id, summary, createdAt FROM chats ORDER BY createdAt DESC limit ? offset ?',
      [limit, offset],
    )) as IChat[];
    const chats = rows.map((chat) => {
      try {
        chat.prompt = chat.prompt ? JSON.parse(chat.prompt as string) : null;
      } catch (err: any) {
        debug('parse chat.prompt failed', err);
      }
      return chat;
    });
    set({ chats });
    return chats;
  },
  deleteChat: async () => {
    const { chat, initChat } = get();
    try {
      if (chat.id !== tempChatId) {
        await window.electron.db.run(`DELETE FROM chats WHERE id = ?`, [
          chat.id,
        ]);
        await window.electron.db.run(`DELETE FROM messages WHERE chatId = ?`, [
          chat.id,
        ]);
        set(
          produce((state: IChatStore) => {
            state.messages = [];
            const index = state.chats.findIndex((i) => i.id === chat.id);
            if (index > -1) {
              state.chats.splice(index, 1);
            }
          }),
        );
      }
      initChat({});
      return true;
    } catch (err: any) {
      captureException(err);
      return false;
    }
  },
  createMessage: async (message: Partial<IChatMessage>) => {
    const msg = {
      id: typeid('msg').toString(),
      ...message,
      createdAt: date2unix(new Date()),
    } as IChatMessage;
    
    // Convert citations array to JSON string if it exists
    if (msg.citations && Array.isArray(msg.citations)) {
      msg.citations = JSON.stringify(msg.citations) as any;
    }
    
    const columns = Object.keys(msg);
    await window.electron.db.run(
      `INSERT INTO messages (${columns.join(',')})
      VALUES(${'?'.repeat(columns.length).split('').join(',')})`,
      Object.values(msg),
    );
    set((state) => ({
      messages: [...state.messages, msg],
    }));
    return msg;
  },
  appendReply: (msgId: string, reply: string, reasoning: string) => {
    let accReply = '';
    let accReasoning = '';
    set(
      produce((state: IChatStore) => {
        const message = state.messages.find((msg) => msg.id === msgId);
        if (message) {
          accReply = message.reply ? `${message.reply}${reply}` : reply;
          accReasoning = message.reasoning
            ? `${message.reasoning}${reasoning}`
            : reasoning;
          message.reply = accReply;
          message.reasoning = accReasoning;
        }
      }),
    );
  },
  updateMessage: async (message: { id: string } & Partial<IChatMessage>) => {
    const msg = { id: message.id } as IChatMessage;
    const stats: string[] = [];
    const params: (string | number)[] = [];
    if (isNotBlank(message.prompt)) {
      stats.push('prompt = ?');
      msg.prompt = message.prompt as string;
      params.push(msg.prompt);
    }
    if (isNotBlank(message.reply)) {
      stats.push('reply = ?');
      msg.reply = message.reply as string;
      params.push(msg.reply);
    }
    if (isNotBlank(message.model)) {
      stats.push('model = ?');
      msg.model = message.model as string;
      params.push(msg.model);
    }
    if (isNumber(message.temperature)) {
      stats.push('temperature = ?');
      msg.temperature = message.temperature as number;
      params.push(msg.temperature);
    }
    if (isNumber(message.inputTokens)) {
      stats.push('inputTokens = ?');
      msg.inputTokens = message.inputTokens as number;
      params.push(msg.inputTokens);
    }
    if (isNumber(message.outputTokens)) {
      stats.push('outputTokens = ?');
      msg.outputTokens = message.outputTokens as number;
      params.push(msg.outputTokens);
    }
    if (!isNil(message.memo)) {
      stats.push('memo = ?');
      msg.memo = message.memo as string;
      params.push(msg.memo);
    }
    if (!isNil(message.isActive)) {
      stats.push('isActive = ?');
      msg.isActive = message.isActive as boolean;
      params.push(msg.isActive ? 1 : 0);
    }
    if (!isBlank(message.citedFiles)) {
      stats.push('citedFiles = ?');
      msg.citedFiles = message.citedFiles as string;
      params.push(msg.citedFiles);
    }
    if (!isBlank(message.citedChunks)) {
      stats.push('citedChunks = ?');
      msg.citedChunks = message.citedChunks as string;
      params.push(msg.citedChunks);
    }
    if(!isBlank(message.reasoning)){
      stats.push('reasoning = ?');
      msg.reasoning = message.reasoning as string;
      params.push(msg.reasoning);
    }
    if (message.citations) {
      stats.push('citations = ?');
      msg.citations = message.citations;
      params.push(JSON.stringify(msg.citations));
    }
    if (message.id && stats.length) {
      params.push(msg.id);
      await window.electron.db.run(
        `UPDATE messages SET ${stats.join(', ')} WHERE id = ?`,
        params,
      );
      set(
        produce((state: IChatStore) => {
          const index = state.messages.findIndex((m) => m.id === msg.id);
          if (index !== -1) {
            state.messages[index] = { ...state.messages[index], ...msg };
          }
        }),
      );
      debug('Update message ', JSON.stringify(msg));
      return true;
    }
    return false;
  },
  bookmarkMessage: (id: string, bookmarkId: string | null) => {
    set(
      produce((state: IChatStore) => {
        state.messages = state.messages.map((msg) => {
          if (msg.id === id) {
            msg.bookmarkId = bookmarkId;
          }
          return msg;
        });
      }),
    );
  },
  deleteMessage: async (id: string) => {
    const ok = await window.electron.db.run(
      `DELETE FROM messages WHERE id = ?`,
      [id],
    );
    if (!ok) {
      throw new Error('Delete message failed');
    }
    const messages = [...get().messages];
    if (messages && messages.length) {
      const index = messages.findIndex((msg) => msg.id === id);
      if (index > -1) {
        debug(`remove msg(${id}) from index: ${index})`);
        messages.splice(index, 1);
        set({ messages: [...messages] });
      }
    }
    return true;
  },
  fetchMessages: async ({
    chatId,
    limit = 100,
    offset = 0,
    keyword = '',
  }: {
    chatId: string;
    limit?: number;
    offset?: number;
    keyword?: string;
  }) => {
    if (chatId === tempChatId) {
      set({ messages: [] });
      return [];
    }
    let sql = `SELECT messages.*, bookmarks.id bookmarkId
    FROM messages
    LEFT JOIN bookmarks ON bookmarks.msgId = messages.id
    WHERE messages.chatId = ?`;
    let params = [chatId, limit, offset];
    if (keyword && keyword.trim() !== '') {
      sql += ` AND (messages.prompt LIKE ? COLLATE NOCASE OR messages.reply LIKE ? COLLATE NOCASE)`;
      params = [
        chatId,
        `%${keyword.trim()}%`,
        `%${keyword.trim()}%`,
        limit,
        offset,
      ];
    }
    sql += `ORDER BY messages.createdAt ASC
    LIMIT ? OFFSET ?`;
    const messages = (await window.electron.db.all(
      sql,
      params,
    )) as IChatMessage[];
    set({ messages });
    return messages;
  },
  editStage: (chatId: string, stage: Partial<IStage>) => {
    if (chatId === tempChatId) {
      set(
        produce((state: IChatStore): void => {
          if (!isUndefined(stage.prompt)) {
            if (isNull(stage.prompt)) {
              state.tempStage.prompt = null;
            } else {
              state.tempStage.prompt = stage.prompt;
            }
          }
          if (!isUndefined(stage.model)) {
            state.tempStage.model = stage.model || '';
          }
          if (!isUndefined(stage.input)) {
            state.tempStage.input = stage.input || '';
          }
          if (!isUndefined(stage.maxCtxMessages)) {
            state.tempStage.maxCtxMessages = stage.maxCtxMessages;
          }
          if (!isUndefined(stage.maxTokens)) {
            state.tempStage.maxTokens = stage.maxTokens;
          }
          if (!isUndefined(stage.temperature)) {
            state.tempStage.temperature = stage.temperature;
          }
          if (!isUndefined(stage.systemMessage)) {
            state.tempStage.systemMessage = stage.systemMessage;
          }
          if (!isUndefined(stage.stream)) {
            state.tempStage.stream = true;
          }
        }),
      );
      get().editChat({ id: chatId, ...stage });
      window.electron.store.set('stage', get().tempStage);
    } else {
      get().updateChat({ id: chatId, ...stage });
    }
  },
  deleteStage: (chatId: string) => {
    set(
      produce((state: IChatStore): void => {
        state.tempStage = defaultTempStage;
      }),
    );
    if (chatId === tempChatId) {
      window.electron.store.set('stage', defaultTempStage);
    }
  },
}));

export default useChatStore;
