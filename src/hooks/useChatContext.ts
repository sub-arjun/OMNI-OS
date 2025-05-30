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

// Add a cache to track recent logs to prevent excessive logging
const recentLogTimestamps: Record<string, number> = {};

// Helper to determine if we should log based on time since last log
const shouldLog = (key: string, intervalMs = 10000): boolean => {
  const now = Date.now();
  const lastLog = recentLogTimestamps[key] || 0;
  
  if (now - lastLog > intervalMs) {
    recentLogTimestamps[key] = now;
    return true;
  }
  
  return false;
};

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
          // Only log occasionally to prevent console spam
          if (shouldLog('ollama_model')) {
            console.log(`Using Ollama model from dedicated storage: ${ollamaModel}`);
          }
          
          // Fix the type issue by casting to string first
          const modelName = String(ollamaModel);
          const modelLabel = String(ollamaModel);
          
          return {
            name: modelName,
            label: modelLabel,
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
          if (shouldLog('ollama_default')) {
            console.warn('No model specified for Ollama, using default');
          }
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
        
        // Log for debugging, but only occasionally
        if (shouldLog('ollama_api_model')) {
          console.log(`Using Ollama model from API settings: ${api.model}`);
        }
        
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
          
          // Map specialized model names to actual model names
          if (specializedModel === 'Deep-Searcher-Pro') {
            specializedModelObj = getChatModel('OMNI', 'perplexity/sonar-reasoning-pro');
            // Only log if we need to (once every 10 seconds)
            if (shouldLog('deep_searcher_pro_model')) {
              console.log('Found Deep-Searcher-Pro model:', specializedModelObj?.name);
            }
          } else if (specializedModel === 'Deep-Thinker-R1') {
            specializedModelObj = getChatModel('OMNI', 'perplexity/r1-1776');
            // Only log occasionally
            if (shouldLog('deep_thinker_r1_model')) {
              console.log('Using specialized model: Deep-Thinker-R1, Name:', specializedModelObj?.name, 'Label:', specializedModelObj?.label);
            }
          } else if (specializedModel === 'Flash 2.5') {
            specializedModelObj = getChatModel('OMNI', 'google/gemini-2.5-flash-preview:thinking');
            // Only log occasionally
            if (shouldLog('flash_25_model')) {
              console.log('Using specialized model: Flash 2.5, Name:', specializedModelObj?.name, 'Label:', specializedModelObj?.label);
            }
          }
          
          if (specializedModelObj && specializedModelObj.name) {
            // Only log occasionally
            if (shouldLog('specialized_model_' + specializedModel)) {
              console.log(`Using specialized model: ${specializedModel}, Name: ${specializedModelObj.name}, Label: ${specializedModelObj.label}`);
            }
            return specializedModelObj;
          } else {
            // Only log occasionally
            if (shouldLog('specialized_model_fallback')) {
              console.log(`Could not find specialized model for ${specializedModel}, falling back to default`);
            }
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
      
      // Debug logging to trace the issue
      if (shouldLog('max_tokens_' + model.name)) {
        console.log('[MAX TOKENS DEBUG]', {
          modelName: model.name,
          modelMaxTokens: model.maxTokens,
          modelDefaultMaxTokens: model.defaultMaxTokens,
          chatMaxTokens: chat?.maxTokens,
          promptMaxTokens: (chat.prompt as IPrompt | null)?.maxTokens,
          DEFAULT_MAX_TOKENS,
        });
      }
      
      // Priority order:
      // 1. Use model's defaultMaxTokens as the safe default
      // 2. Model's maxTokens defines the upper limit
      // 3. Fall back to DEFAULT_MAX_TOKENS only if model has neither
      const modelDefault = model.defaultMaxTokens || model.maxTokens || DEFAULT_MAX_TOKENS;
      const modelLimit = model.maxTokens || model.defaultMaxTokens || DEFAULT_MAX_TOKENS;
      
      // Start with the conservative default
      let maxTokens = modelDefault;
      
      // Check if prompt has a specific maxTokens override
      const prompt = chat.prompt as IPrompt | null;
      if (
        prompt?.maxTokens != null &&
        isValidMaxTokens(prompt?.maxTokens, api.provider, model.name) &&
        prompt.maxTokens <= modelLimit
      ) {
        maxTokens = prompt.maxTokens;
      }
      
      // Check if chat has a specific maxTokens setting
      // Only use it if it's not the old hardcoded default and within model limits
      if (
        chat?.maxTokens != null &&
        chat.maxTokens !== DEFAULT_MAX_TOKENS && // Ignore the old hardcoded 2048 value
        isValidMaxTokens(chat?.maxTokens, api.provider, model.name) &&
        chat.maxTokens <= modelLimit
      ) {
        maxTokens = chat.maxTokens;
      }
      
      // Final debug log
      if (shouldLog('max_tokens_final_' + model.name)) {
        console.log('[MAX TOKENS DEBUG] Final value:', maxTokens, '(model default:', modelDefault, ', model limit:', modelLimit, ')');
      }
      
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
