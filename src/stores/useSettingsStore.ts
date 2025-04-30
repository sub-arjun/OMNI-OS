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

// Safe store access with fallbacks
const safeStore = {
  get: (key: string, defaultValue: any) => {
    try {
      return window.electron?.store?.get?.(key, defaultValue) ?? defaultValue;
    } catch (e) {
      console.error('Error accessing electron store:', e);
      return defaultValue;
    }
  },
  set: (key: string, value: any) => {
    try {
      window.electron?.store?.set?.(key, value);
    } catch (e) {
      console.error('Error setting electron store:', e);
    }
  }
};

export interface ISettingStore {
  theme: ThemeType;
  language: LanguageType;
  fontSize: FontSize;
  api: IAPISettings;
  modelMapping: IModelMapping;
  toolStates: IToolStates;
  autoEnabled: boolean;
  specializedModel: string | null;
  isSettingsLoaded: boolean;
  setTheme: (theme: ThemeType) => Promise<void>;
  setAPI: (api: Partial<IAPISettings>) => Promise<void>;
  setModelMapping: (modelMapping: IModelMapping) => Promise<void>;
  setToolState: (
    providerName: string,
    modelName: string,
    state: boolean,
  ) => Promise<void>;
  getToolState: (
    providerName: string,
    modelName: string,
  ) => boolean | undefined;
  setAutoEnabled: (auto: boolean) => Promise<void>;
  setLanguage: (language: LanguageType) => Promise<void>;
  setFontSize: (fontSize: FontSize) => Promise<void>;
  setSpecializedModel: (modelName: string | null) => Promise<void>;
  loadSettings: () => Promise<void>;
}

const useSettingsStore = create<ISettingStore>((set, get) => ({
  theme: defaultTheme,
  language: defaultLanguage,
  fontSize: defaultFontSize,
  api: defaultAPI,
  modelMapping: defaultModelMapping,
  toolStates: defaultToolStates,
  autoEnabled: true,
  specializedModel: null,
  isSettingsLoaded: false,

  loadSettings: async () => {
    debug('Attempting to load settings from electron store...');
    try {
      const settings = await window.electron?.store?.get('settings', {});
      debug('Loaded settings:', settings);
      if (settings) {
        let apiSettings = defaultAPI;
        if (settings.api && settings.api.activeProvider && settings.api.providers) {
           const activeProviderKey = String(settings.api.activeProvider) === 'OMNI Edge' 
                                     ? 'Ollama' 
                                     : settings.api.activeProvider;
           apiSettings = settings.api.providers[activeProviderKey] || defaultAPI;
           apiSettings.provider = settings.api.activeProvider; 
        } else {
            debug('API settings structure missing or invalid, using default.');
        }

        set({
          theme: settings.theme || defaultTheme,
          language: settings.language || defaultLanguage,
          fontSize: settings.fontSize || defaultFontSize,
          api: apiSettings,
          modelMapping: settings.modelMapping || defaultModelMapping,
          toolStates: settings.toolStates || defaultToolStates,
          autoEnabled: settings.autoOMNIEnabled !== false,
          specializedModel: settings.specializedModel || null,
          isSettingsLoaded: true,
        });
        debug('Settings loaded and state updated.');
      } else {
        debug('No settings found in store, using defaults.');
        set({ isSettingsLoaded: true });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      debug('Failed to load settings, using defaults.');
      set({ isSettingsLoaded: true });
    }
  },

  setTheme: async (theme: ThemeType) => {
    set({ theme });
    await window.electron?.store?.set('settings.theme', theme);
  },
  setAPI: async (api: Partial<IAPISettings>) => {
    let finalAPI: IAPISettings = defaultAPI;
    set((state) => {
      const provider = api.provider ?? state.api.provider;
      const base = api.base ?? state.api.base;
      const key = api.key ?? state.api.key;
      const secret = api.secret ?? state.api.secret;
      const model = api.model ?? state.api.model;
      const deploymentId = api.deploymentId ?? state.api.deploymentId;
      finalAPI = {
        provider,
        base,
        key,
        secret,
        deploymentId,
        model,
      } as IAPISettings;
      return { api: finalAPI };
    });

    try {
      const providerLookupKey = String(finalAPI.provider) === 'OMNI Edge' ? 'Ollama' : finalAPI.provider;
      const providerObj = getProvider(providerLookupKey);
      const apiSchema = providerObj?.chat?.apiSchema || ['base', 'model', 'provider', 'key', 'secret', 'deploymentId'];
      await window.electron?.store?.set('settings.api.activeProvider', finalAPI.provider);
      const configToStore = pick(finalAPI, [...apiSchema, 'provider']);
      await window.electron?.store?.set(
        `settings.api.providers.${providerLookupKey}`,
        configToStore
      );
      
      if (providerLookupKey === 'Ollama' && finalAPI.model) {
         await window.electron?.store?.set(
           `settings.api.providers.${providerLookupKey}.model`, 
           finalAPI.model
         );
       }
      debug('API settings persisted for:', providerLookupKey);
    } catch (error) {
      console.error('Error persisting API settings:', error);
    }
  },
  setModelMapping: async (modelMapping: IModelMapping) => {
    set({ modelMapping });
    await window.electron?.store?.set('settings.modelMapping', modelMapping);
  },
  setToolState: async (providerName: string, modelName: string, state: boolean) => {
    let newToolStates: IToolStates = {};
    set((currentState) => {
      const key = `${providerName}.${modelName}`;
      newToolStates = { ...currentState.toolStates, [key]: state };
      return { toolStates: newToolStates };
    });
    await window.electron?.store?.set('settings.toolStates', newToolStates);
  },
  getToolState(providerName: string, modelName: string) {
    return get().toolStates[`${providerName}.${modelName}`];
  },
  setAutoEnabled: async (auto: boolean) => {
    set({ autoEnabled: auto });
    await window.electron?.store?.set('settings.autoOMNIEnabled', auto);
  },
  setLanguage: async (language: LanguageType) => {
    set({ language });
    await window.electron?.store?.set('settings.language', language);
  },
  setFontSize: async (fontSize: FontSize) => {
    set({ fontSize });
    await window.electron?.store?.set('settings.fontSize', fontSize);
  },
  setSpecializedModel: async (modelName: string | null) => {
    set({ specializedModel: modelName });
    await window.electron?.store?.set('settings.specializedModel', modelName);
  }
}));

export default useSettingsStore;
