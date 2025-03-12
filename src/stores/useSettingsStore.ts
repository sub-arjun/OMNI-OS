import { IModelMapping, IToolStates } from './../types/settings.d';
/* eslint-disable no-console */
import Debug from 'debug';
import { create } from 'zustand';
import { isNil, pick, set } from 'lodash';

import { FontSize, ThemeType } from '../types/appearance';
import { LanguageType } from '../types/settings';
import { IAPISettings, ISettings } from '../types/settings';
import { getProvider } from 'providers';

const debug = Debug('OMNI-OS:stores:useSettingsStore');

const defaultTheme = 'system';
const defaultLanguage = 'system';
const defaultFontSize = 'base';

const defaultAPI: IAPISettings = {
  provider: 'OMNI',
  base: 'https://openrouter.ai',
  key: '',
  model: '',
};

const defaultModelMapping: IModelMapping = {};
const defaultToolStates: IToolStates = {};

export interface ISettingStore {
  theme: ThemeType;
  language: LanguageType;
  fontSize: FontSize;
  api: IAPISettings;
  modelMapping: IModelMapping;
  toolStates: IToolStates;
  autoEnabled: boolean;
  setTheme: (theme: ThemeType) => void;
  setAPI: (api: Partial<IAPISettings>) => void;
  setModelMapping: (modelMapping: IModelMapping) => void;
  setToolState: (
    providerName: string,
    modelName: string,
    state: boolean,
  ) => void;
  getToolState: (
    providerName: string,
    modelName: string,
  ) => boolean | undefined;
  setAutoEnabled: (auto: boolean) => void;
  setLanguage: (language: LanguageType) => void;
  setFontSize: (fontSize: FontSize) => void;
  specializedModel: string | null;
  setSpecializedModel: (modelName: string | null) => void;
}

const settings = window.electron.store.get('settings', {}) as ISettings;
let apiSettings = defaultAPI;
if (settings.api?.activeProvider) {
  apiSettings =
    settings.api.providers[settings.api.activeProvider] || defaultAPI;
}

const useSettingsStore = create<ISettingStore>((set, get) => ({
  theme: settings?.theme || defaultTheme,
  language: settings?.language || defaultLanguage,
  fontSize: settings?.fontSize || defaultFontSize,
  modelMapping: settings.modelMapping || defaultModelMapping,
  toolStates: settings.toolStates || defaultToolStates,
  autoEnabled: settings.autoEnabled !== false && (settings as any).autoOMNIEnabled !== false, // Default to true if not set
  api: apiSettings,
  specializedModel: null,
  setTheme: async (theme: ThemeType) => {
    set({ theme });
    window.electron.store.set('settings.theme', theme);
  },
  setAPI: (api: Partial<IAPISettings>) => {
    set((state) => {
      const provider = isNil(api.provider) ? state.api.provider : api.provider;
      const base = isNil(api.base) ? state.api.base : api.base;
      const key = isNil(api.key) ? state.api.key : api.key;
      const secret = isNil(api.secret) ? state.api.secret : api.secret;
      const model = isNil(api.model) ? state.api.model : api.model;
      const deploymentId = isNil(api.deploymentId)
        ? state.api.deploymentId
        : api.deploymentId;
      const newAPI = {
        provider,
        base,
        key,
        secret,
        deploymentId,
        model,
      } as IAPISettings;
      
      try {
        // Map OMNI Edge to Ollama for provider lookup
        const providerLookupKey = String(provider) === 'OMNI Edge' ? 'Ollama' : provider;
        
        // Debug logs for Ollama model persistence
        if (providerLookupKey === 'Ollama') {
          console.log(`Setting Ollama model to: ${model}`);
        }
        
        const providerObj = getProvider(providerLookupKey);
        // Safely access the apiSchema with fallback
        const apiSchema = providerObj?.chat?.apiSchema || ['base', 'model', 'provider'];
        
        // Ensure we're storing the complete config including model for Ollama
        window.electron.store.set('settings.api.activeProvider', provider);
        
        const configToStore = pick(newAPI, [...apiSchema, 'provider']);
        console.log(`Storing config for ${providerLookupKey}:`, configToStore);
        
        window.electron.store.set(
          `settings.api.providers.${providerLookupKey}`,
          configToStore
        );
        
        // Special handling to ensure Ollama model name is preserved correctly
        if (providerLookupKey === 'Ollama' && model) {
          window.electron.store.set(
            `settings.api.providers.${providerLookupKey}.model`, 
            model
          );
        }
      } catch (error) {
        console.error('Error in setAPI:', error);
        // Just set the activeProvider without trying to save provider-specific settings
        window.electron.store.set('settings.api.activeProvider', provider);
      }
      
      return { api: newAPI };
    });
  },
  setModelMapping: (modelMapping: IModelMapping) => {
    set({ modelMapping });
    window.electron.store.set('settings.modelMapping', modelMapping);
  },
  setToolState(providerName: string, modelName: string, state: boolean) {
    set((currentState) => {
      const key = `${providerName}.${modelName}`;
      const newToolStates = { ...currentState.toolStates, [key]: state };
      window.electron.store.set('settings.toolStates', newToolStates);
      return { toolStates: newToolStates };
    });
  },
  getToolState(providerName: string, modelName: string) {
    return get().toolStates[`${providerName}.${modelName}`];
  },
  setAutoEnabled(auto: boolean) {
    set({ autoEnabled: auto });
    window.electron.store.set('settings.autoOMNIEnabled', auto);
  },
  setLanguage: (language: 'en' | 'zh' | 'system') => {
    set({ language });
    window.electron.store.set('settings.language', language);
  },
  setFontSize: (fontSize: FontSize) => {
    set({ fontSize });
    window.electron.store.set('settings.fontSize', fontSize);
  },
  setSpecializedModel: (modelName: string | null) => set({ specializedModel: modelName }),
}));

export default useSettingsStore;
