import Debug from 'debug';

import useChatStore from 'stores/useChatStore';
import useSettingsStore from 'stores/useSettingsStore';
import { DEFAULT_MAX_TOKENS, NUM_CTX_MESSAGES, tempChatId } from 'consts';
import { useMemo } from 'react';
import { isNil, isNumber, isUndefined } from 'lodash';
import { isValidMaxTokens, isValidTemperature } from 'intellichat/validators';

import useProvider from './useProvider';
import { IChat, IChatContext, IChatMessage, IPrompt } from 'intellichat/types';
import { IChatModel } from 'providers/types';

const debug = Debug('OMNI-OS:hooks:useChatContext');

export default function useChatContext(): IChatContext {
  const { getProvider: getChatProvider, getChatModel } = useProvider();

  const context = useMemo(() => {
    const getActiveChat = () => {
      const { chat } = useChatStore.getState();
      // debug(`Chat(${chat.id}):getActiveChat: ${chat.summary}`);
      return {
        ...chat,
        isPersisted: !!(chat?.id && chat.id !== tempChatId),
      } as IChat;
    };

    const getProvider = () => {
      const { api } = useSettingsStore.getState();
      return getChatProvider(api.provider);
    };

    /**
     * Notice: 用户在切换服务商后，chat 使用的模型可能不再被支持
     * 因此要判断当前模型是否在支持的模型列表中，
     * 如果不在，则使用设置的模型
     */
    const getModel = () => {
      const { api } = useSettingsStore.getState();
      const defaultModel = { name: api.model, label: api.model } as IChatModel;
      
      // Check if a specialized model is selected
      const { specializedModel } = useSettingsStore.getState();
      
      // For Ollama, use the model name from our dedicated storage
      if (api.provider === 'Ollama') {
        // Check our dedicated storage first
        const ollamaModel = window.electron?.store?.get('settings.ollama.currentModel', null);
        
        if (ollamaModel) {
          console.log(`Using Ollama model from dedicated storage: ${ollamaModel}`);
          return {
            name: ollamaModel,
            label: ollamaModel,
            contextWindow: 8192,
            maxTokens: 4000,
            defaultMaxTokens: 4000,
            inputPrice: 0,
            outputPrice: 0,
            isDefault: true,
            group: 'Open Source'
          } as IChatModel;
        }
        
        // Make sure we have a valid model name
        if (!api.model || api.model.trim() === '' || api.model === 'default') {
          console.warn('No model specified for Ollama, using default');
          const defaultOllamaModel = 'llama3';
          // Store the default in our dedicated storage
          window.electron.store.set('settings.ollama.currentModel', defaultOllamaModel);
          return { 
            name: defaultOllamaModel,
            label: 'Llama 3',
            contextWindow: 8192,
            maxTokens: 4000,
            defaultMaxTokens: 4000,
            inputPrice: 0,
            outputPrice: 0,
            isDefault: true,
            group: 'Open Source'
          } as IChatModel;
        }
        
        // Save to dedicated storage
        window.electron.store.set('settings.ollama.currentModel', api.model);
        
        // Log for debugging
        console.log(`Using Ollama model from API settings: ${api.model}`);
        
        // Use the model name from settings
        return {
          name: api.model,
          label: api.model,
          contextWindow: 8192,
          maxTokens: 4000,
          defaultMaxTokens: 4000,
          inputPrice: 0,
          outputPrice: 0,
          isDefault: true,
          group: 'Open Source'
        } as IChatModel;
      }
      
      // If specialized model is selected, find and return the appropriate model
      if (specializedModel && api.provider === 'OMNI') {
        try {
          let specializedModelObj: IChatModel | undefined;
          
          // Find the specialized model based on its type
          if (specializedModel === 'Deep-Searcher-R1') {
            // Look for Deep-Searcher-Pro model instead of Sonar Reasoning
            specializedModelObj = getChatModel(api.provider, 'Deep-Searcher-Pro');
            if (specializedModelObj) {
              console.log(`Found Deep-Searcher-Pro model: ${specializedModelObj.name}`);
            } else {
              console.log('Deep-Searcher-Pro model not found, checking by model name');
              // Fall back to direct model name lookup if needed
              const provider = getChatProvider(api.provider);
              if (provider?.chat?.models) {
                // Look through all models manually
                for (const key in provider.chat.models) {
                  const model = provider.chat.models[key];
                  if (model.name === 'perplexity/sonar-reasoning-pro') {
                    specializedModelObj = model;
                    console.log(`Found model by name: ${model.name}`);
                    break;
                  }
                }
              }
            }
          } else if (specializedModel === 'Deep-Thinker-R1') {
            specializedModelObj = getChatModel(api.provider, 'Deep-Thinker-R1');
            if (!specializedModelObj || !specializedModelObj.name) {
              // Fall back to direct model name lookup if needed
              const provider = getChatProvider(api.provider);
              if (provider?.chat?.models) {
                // Look through all models manually
                for (const key in provider.chat.models) {
                  const model = provider.chat.models[key];
                  if (model.name === 'perplexity/r1-1776') {
                    specializedModelObj = model;
                    break;
                  }
                }
              }
            }
          } else if (specializedModel === 'Flash-2.0') {
            specializedModelObj = getChatModel(api.provider, 'Flash-2.0');
            if (!specializedModelObj || !specializedModelObj.name) {
              // Fall back to direct model name lookup if needed
              const provider = getChatProvider(api.provider);
              if (provider?.chat?.models) {
                // Look through all models manually
                for (const key in provider.chat.models) {
                  const model = provider.chat.models[key];
                  if (model.name === 'google/gemini-2.0-flash-001') {
                    specializedModelObj = model;
                    break;
                  }
                }
              }
            }
          }
          
          if (specializedModelObj && specializedModelObj.name) {
            console.log(`Using specialized model: ${specializedModel}, Name: ${specializedModelObj.name}, Label: ${specializedModelObj.label}`);
            return specializedModelObj;
          } else {
            console.log(`Could not find specialized model for ${specializedModel}, falling back to default`);
          }
        } catch (err) {
          console.error('Error finding specialized model:', err);
        }
      }
      
      let model = getChatModel(api.provider, api.model) || defaultModel;
      if (api.provider === 'Azure') {
        return model;
      }
      const { chat } = useChatStore.getState();
      if (chat?.model) {
        model = getChatModel(api.provider, chat.model) || model;
      }
      // debug(`Chat(${chat.id}):getModel: ${model.label}`);
      return model;
    };

    const getSystemMessage = () => {
      const chat = useChatStore.getState().chat;
      const prompt = chat.prompt as IPrompt | null;
      const systemMessage =
        prompt?.systemMessage || chat?.systemMessage || null;
      // debug(`Chat(${chat.id}):getSystemMessage: ${systemMessage}`);
      return systemMessage;
    };

    const getTemperature = (): number => {
      const { chat } = useChatStore.getState();
      const { api } = useSettingsStore.getState();
      let temperature = getChatProvider(api.provider).chat.temperature
        .default as number;
      const prompt = chat.prompt as IPrompt | null;
      if (isValidTemperature(prompt?.temperature, api.provider)) {
        temperature = prompt?.temperature as number;
      }
      if (isValidTemperature(chat?.temperature, api.provider)) {
        temperature = chat?.temperature as number;
      }
      // debug(`Chat(${chat.id}):getSystemMessage: ${temperature}`);
      return temperature;
    };

    const getMaxTokens = () => {
      const { chat } = useChatStore.getState();
      const { api } = useSettingsStore.getState();
      const model = getModel();
      let maxTokens =
        model.defaultMaxTokens || model.maxTokens || DEFAULT_MAX_TOKENS;
      const prompt = chat.prompt as IPrompt | null;
      if (
        prompt?.maxTokens != null &&
        isValidMaxTokens(prompt?.maxTokens, api.provider, model.name)
      ) {
        maxTokens = prompt?.maxTokens || (prompt?.maxTokens as number);
      }
      if (
        chat?.maxTokens != null &&
        isValidMaxTokens(chat?.maxTokens, api.provider, model.name)
      ) {
        maxTokens = chat?.maxTokens as number;
      }
      // debug(`Chat(${chat.id}):getMaxTokens: ${maxTokens}`);
      return maxTokens as number;
    };

    const getChatContext = () => {
      const { chat } = useChatStore.getState();
      const chatContext = chat?.context || '';
      // debug(`Chat(${chat.id}):getChatContext: ${chatContext}`);
      return chatContext;
    };

    const isStream = () => {
      // Always use streaming mode, ignoring any stored settings
      return true;
    };

    const isToolEnabled = () => {
      const { getToolState } = useSettingsStore.getState();
      const model = getModel();
      let toolEnabled = getToolState(getProvider().name, model.name);
      if (typeof toolEnabled === 'undefined') {
        toolEnabled = model.toolEnabled || false;
      }
      return Boolean(toolEnabled);
    };

    const getCtxMessages = () => {
      const { chat } = useChatStore.getState();
      let ctxMessages: IChatMessage[] = [];
      const maxCtxMessages = isNumber(chat?.maxCtxMessages)
        ? chat?.maxCtxMessages
        : NUM_CTX_MESSAGES;
      if (maxCtxMessages > 0) {
        const messages = useChatStore.getState().messages || [];
        if (messages.length <= maxCtxMessages) {
          ctxMessages = messages.slice(0, -1);
        } else {
          // @NOTE: 去除最后一条外的最后的 maxCtxMessages 条 （最后一条是刚创建的）
          ctxMessages = messages.slice(
            -maxCtxMessages - 1,
            messages.length - 1,
          );
        }
      }
      // debug(`Chat(${chat.id}):getCtxMessages: ${ctxMessages.length} messages`);
      return ctxMessages;
    };

    const ctx = {
      getActiveChat,
      getProvider,
      getModel,
      getSystemMessage,
      getCtxMessages,
      getTemperature,
      getMaxTokens,
      getChatContext,
      isStream,
      isToolEnabled,
    };
    return ctx;
  }, []);

  return context;
}
