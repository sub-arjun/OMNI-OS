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

// Define the chat folder interface
export interface IChatFolder {
  id: string;
  name: string;
  createdAt: number;
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
  // Chat folders
  folders: IChatFolder[];
  folderOperationInProgress: boolean;
  // States
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
  appendReply: (msgId: string, replyDelta: string, reasoningDelta: string) => void;
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
  // folder
  createFolder: (name: string) => Promise<IChatFolder>;
  updateFolder: (folder: { id: string, name: string }) => Promise<boolean>;
  deleteFolder: (id: string) => Promise<boolean>;
  fetchFolders: () => Promise<IChatFolder[]>;
  assignChatToFolder: (chatId: string, folderId: string | null) => Promise<boolean>;
}

const useChatStore = create<IChatStore>((set, get) => ({
  keywords: {},
  chats: [],
  chat: { id: tempChatId, ...tempStage },
  messages: [],
  states: {},
  // only for temp chat
  tempStage,
  // folders
  folders: [],
  folderOperationInProgress: false,
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
      `INSERT INTO chats (id, summary, model, systemMessage, temperature, maxCtxMessages, maxTokens, stream, prompt, input, createdAt, folderId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        $chat.folderId || null,
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
    if (!isUndefined(chat.folderId)) {
      $chat.folderId = chat.folderId;
      stats.push('folderId = ?');
      params.push($chat.folderId || null);
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
      'SELECT id, summary, model, systemMessage, maxTokens, temperature, context, maxCtxMessages, stream, prompt, input, createdAt, folderId FROM chats where id = ?',
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
    // Add cache with 3 second expiry to reduce database calls
    const cacheKey = `chats-${limit}-${offset}`;
    const cachedChats = sessionStorage.getItem(cacheKey);
    const cacheTime = sessionStorage.getItem(`${cacheKey}-time`);
    const now = Date.now();

    // Use cache if it exists and is less than 3 seconds old
    if (cachedChats && cacheTime && (now - parseInt(cacheTime)) < 3000) {
      const chats = JSON.parse(cachedChats);
      set({ chats });
      return chats;
    }

    const rows = (await window.electron.db.all(
      'SELECT id, summary, createdAt, folderId FROM chats ORDER BY createdAt DESC limit ? offset ?',
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
    
    // Cache the results
    sessionStorage.setItem(cacheKey, JSON.stringify(chats));
    sessionStorage.setItem(`${cacheKey}-time`, now.toString());
    
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
  appendReply: (msgId: string, replyDelta: string, reasoningDelta: string) => {
    // Don't update if there's nothing new to add
    if (!replyDelta && !reasoningDelta) return;
    
    set(
      produce((state: IChatStore) => {
        const message = state.messages.find((msg) => msg.id === msgId);
        if (message) {
          // Calculate what the new values would be by appending the DELTA
          const newReply = message.reply ? `${message.reply}${replyDelta}` : replyDelta;
          const newReasoning = message.reasoning
            ? `${message.reasoning}${reasoningDelta}`
            : reasoningDelta;
          
          // Simplified check: Only update if there's actually new content to add
          const replyChanged = newReply !== message.reply;
          const reasoningChanged = newReasoning !== message.reasoning;
          
          if (replyChanged || reasoningChanged) {
            message.reply = newReply;
            message.reasoning = newReasoning;
          }
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
      debug('Received citations in updateMessage:', message.citations);
      debug('Citations type:', typeof message.citations);
      debug('Is Array:', Array.isArray(message.citations));
      
      stats.push('citations = ?');
      
      // Ensure citations are properly stored as a stringified JSON array
      let citationsJson: string;
      
      if (Array.isArray(message.citations)) {
        // If already an array, stringify it
        msg.citations = message.citations;
        citationsJson = JSON.stringify(message.citations);
      } else if (typeof message.citations === 'string') {
        try {
          // If it's a string, check if it's already JSON
          JSON.parse(message.citations);
          // If no error, it's valid JSON, use as is
          msg.citations = message.citations;
          citationsJson = message.citations;
        } catch (e) {
          // If it's a string but not valid JSON, treat it as a single citation
          msg.citations = [message.citations];
          citationsJson = JSON.stringify(msg.citations);
        }
      } else {
        // Fallback
        msg.citations = [];
        citationsJson = '[]';
      }
      
      debug('Final stringified citations:', citationsJson);
      params.push(citationsJson);
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
            
            // When switching models, only update input if explicitly provided
            // This prevents the input from being cleared when switching models
            if (isUndefined(stage.input)) {
              // Don't change the input when just switching models
              // Keep existing input
            } else {
              state.tempStage.input = stage.input || '';
            }
          } else {
            // Normal case - update input when provided
            if (!isUndefined(stage.input)) {
              state.tempStage.input = stage.input || '';
            }
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
      // For persisted chats, ensure we don't clear the input when changing models
      const updatedStage = { ...stage };
      
      if (!isUndefined(updatedStage.model) && isUndefined(updatedStage.input)) {
        // If changing model but no input provided, keep the existing input
        const currentInput = get().chat.input || '';
        updatedStage.input = currentInput;
      }
      
      get().updateChat({ id: chatId, ...updatedStage });
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
  // Folder management
  createFolder: async (name: string) => {
    try {
      debug('Creating folder with name:', name);
      
      // Set a loading state flag
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = true;
        })
      );
      
      const folder = {
        id: typeid('folder').toString(),
        name,
        createdAt: date2unix(new Date()),
      } as IChatFolder;
      
      debug('Folder object created:', folder);
      
      // Use a transaction to ensure atomic operation
      const ok = await window.electron.db.transaction([
        {
          sql: `INSERT INTO chat_folders (id, name, createdAt) VALUES (?, ?, ?)`,
          params: [folder.id, folder.name, folder.createdAt],
        }
      ]);
      
      if (!ok) {
        debug('Failed to insert folder into database');
        throw new Error('Write the folder into database failed');
      }
      
      debug('Successfully inserted folder into database:', folder.id);
      
      // Update state
      set(
        produce((state: IChatStore) => {
          state.folders = state.folders ? [folder, ...state.folders] : [folder];
          state.folderOperationInProgress = false;
        }),
      );
      
      return folder;
    } catch (err) {
      debug('Error in createFolder:', err);
      
      // Reset loading state
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = false;
        })
      );
      
      // Rethrow to allow handling in the component
      throw err;
    }
  },
  
  updateFolder: async (folder: { id: string, name: string }) => {
    try {
      debug('Update folder', folder);
      
      // Set a loading state flag
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = true;
        })
      );
      
      const ok = await window.electron.db.run(
        `UPDATE chat_folders SET name = ? WHERE id = ?`,
        [folder.name, folder.id],
      );
      
      if (ok) {
        set(
          produce((state: IChatStore) => {
            if (!state.folders) {
              state.folders = [];
              return;
            }
            const index = state.folders.findIndex(f => f.id === folder.id);
            if (index !== -1) {
              state.folders[index].name = folder.name;
            }
            state.folderOperationInProgress = false;
          }),
        );
        return true;
      }
      
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = false;
        })
      );
      
      return false;
    } catch (err) {
      debug('Error updating folder:', err);
      
      // Reset loading state
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = false;
        })
      );
      
      return false;
    }
  },
  
  deleteFolder: async (id: string) => {
    try {
      debug('Delete folder', id);
      
      // Set a loading state flag
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = true;
        })
      );
      
      // Use transaction to ensure atomicity
      const ok = await window.electron.db.transaction([
        {
          sql: `UPDATE chats SET folderId = NULL WHERE folderId = ?`,
          params: [id],
        },
        {
          sql: `DELETE FROM chat_folders WHERE id = ?`,
          params: [id],
        }
      ]);
      
      if (ok) {
        // Update UI state
        set(
          produce((state: IChatStore) => {
            // Update all chats that were in this folder
            if (state.chats) {
              state.chats = state.chats.map(chat => {
                if (chat.folderId === id) {
                  return { ...chat, folderId: null };
                }
                return chat;
              });
            }
            
            // Remove folder
            if (state.folders) {
              state.folders = state.folders.filter(folder => folder.id !== id);
            }
            
            state.folderOperationInProgress = false;
          }),
        );
        return true;
      }
      
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = false;
        })
      );
      
      return false;
    } catch (err) {
      debug('Error deleting folder:', err);
      
      // Reset loading state
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = false;
        })
      );
      
      return false;
    }
  },
  
  fetchFolders: async () => {
    try {
      debug('Fetching folders...');
      
      // Add cache with 3 second expiry to reduce database calls
      const cacheKey = 'folders';
      const cachedFolders = sessionStorage.getItem(cacheKey);
      const cacheTime = sessionStorage.getItem(`${cacheKey}-time`);
      const now = Date.now();
      
      // Use cache if it exists and is less than 3 seconds old
      if (cachedFolders && cacheTime && (now - parseInt(cacheTime)) < 3000) {
        const folders = JSON.parse(cachedFolders);
        set({ folders });
        return folders;
      }
      
      // Try up to 3 times if there are issues
      let attempt = 0;
      let rows = null;
      let error = null;
      
      while (attempt < 3 && !rows) {
        try {
          if (attempt > 0) {
            debug(`Retry attempt ${attempt} for fetching folders`);
          }
          
          rows = (await window.electron.db.all(
            'SELECT id, name, createdAt FROM chat_folders ORDER BY name ASC'
          )) as IChatFolder[];
          
          if (!rows) {
            throw new Error('No results returned from database query');
          }
        } catch (err) {
          error = err;
          attempt++;
          if (attempt < 3) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          }
        }
      }
      
      // If we still have no rows after retries, handle the error
      if (!rows) {
        debug('Failed to fetch folders after retries:', error);
        throw error || new Error('Unknown error fetching folders');
      }
      
      debug(`Successfully fetched ${rows.length} folders`);
      
      // Extra verification for debug purposes
      if (rows.length > 0) {
        debug('First folder retrieved:', rows[0]);
      }
      
      // Cache the results
      sessionStorage.setItem(cacheKey, JSON.stringify(rows));
      sessionStorage.setItem(`${cacheKey}-time`, now.toString());
      
      // Always set folders, even if empty array
      set({ folders: rows });
      
      return rows;
    } catch (error) {
      debug('Error in fetchFolders:', error);
      
      // Always return at least an empty array to avoid undefined
      return [];
    }
  },
  
  assignChatToFolder: async (chatId: string, folderId: string | null) => {
    if (chatId === tempChatId) return false;
    
    try {
      debug('Assigning chat', chatId, 'to folder', folderId);
      
      // Set loading state
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = true;
        })
      );
      
      // Use transaction for atomicity
      const ok = await window.electron.db.run(
        `UPDATE chats SET folderId = ? WHERE id = ?`,
        [folderId, chatId],
      );
      
      if (ok) {
        set(
          produce((state: IChatStore) => {
            // Update current chat if it's the one being modified
            if (state.chat.id === chatId) {
              state.chat.folderId = folderId;
            }
            
            // Update the chat in the chats array
            state.chats = state.chats.map(chat => {
              if (chat.id === chatId) {
                return { ...chat, folderId };
              }
              return chat;
            });
            
            // Reset loading state
            state.folderOperationInProgress = false;
          }),
        );
        return true;
      }
      
      // Reset loading state on failure
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = false;
        })
      );
      
      return false;
    } catch (err) {
      debug('Error assigning chat to folder:', err);
      
      // Reset loading state on error
      set(
        produce((state: IChatStore) => {
          state.folderOperationInProgress = false;
        })
      );
      
      return false;
    }
  },
}));

export default useChatStore;
