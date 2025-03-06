import { providers } from '../providers';
import { IChatModel, IServiceProvider, ProviderType } from 'providers/types';
import useAuthStore from 'stores/useAuthStore';
import useSettingsStore from 'stores/useSettingsStore';

export default function useProvider() {
  // Don't access store states directly here, as it can cause issues before store initialization
  // Instead, access them inside the functions where they're actually needed

  function getProviders(arg?:{withDisabled:boolean}): { [key: string]: IServiceProvider } {
    // Show OMNI and Ollama providers in the frontend
    return Object.values(providers).reduce(
      (acc: { [key: string]: IServiceProvider }, cur: IServiceProvider) => {
        // Only allow OMNI and Ollama providers to be shown in the frontend
        if (cur.name === 'OMNI' || cur.name === 'Ollama') {
          // Ensure Ollama has the correct displayName
          if (cur.name === 'Ollama') {
            cur.displayName = 'OMNI Edge';
          }
          acc[cur.name] = cur;
        }
        return acc;
      },
      {} as { [key: string]: IServiceProvider }
    );
  }

  function getProvider(providerName: ProviderType): IServiceProvider {
    // Map OMNI Edge to Ollama if needed
    const lookupName = String(providerName) === 'OMNI Edge' ? 'Ollama' as ProviderType : providerName;
    
    // Return the actual requested provider
    const provider = providers[lookupName];
    
    // If provider doesn't exist, log error but DON'T provide a fallback
    // This allows the system to handle missing providers in a more visible way
    if (!provider) {
      console.error(`Provider not found: ${providerName}`);
      // For safety, return a minimal valid provider structure without changing the requested name
      return {
        name: providerName,
        displayName: providerName,
        apiBase: '',
        currency: 'USD',
        chat: {
          apiSchema: ['base', 'model'],
          docs: {},
          placeholders: { base: '' },
          presencePenalty: { min: -2, max: 2, default: 0 },
          topP: { min: 0, max: 1, default: 1 },
          temperature: { min: 0, max: 2, default: 0.9 },
          options: { modelCustomizable: true },
          models: {
            'Default Model': {
              name: 'default',
              label: 'Default Model',
              contextWindow: 4000,
              maxTokens: 2000,
              defaultMaxTokens: 2000,
              inputPrice: 0,
              outputPrice: 0,
              isDefault: true,
              group: 'Default'
            }
          }
        },
        options: {
          apiBaseCustomizable: true,
          apiKeyCustomizable: false,
        }
      } as unknown as IServiceProvider;
    }
    
    return provider;
  }

  function getDefaultChatModel(providerName: ProviderType): IChatModel {
    try {
      // Get all models for the provider
      const models = getChatModels(providerName);
      
      if (!models || models.length === 0) {
        // Return a minimal valid model object if no models are found
        return {
          name: 'default',
          label: 'Default Model',
          contextWindow: 8192,
          maxTokens: 4000,
          defaultMaxTokens: 4000,
          inputPrice: 0,
          outputPrice: 0,
          isDefault: true,
          group: 'Open Source'
        } as IChatModel;
      }
      
      // Find a model marked as default, or use the first one
      const defaultModel = models.find((m: IChatModel) => m.isDefault);
      return defaultModel || models[0];
    } catch (error) {
      console.error(`Error getting default chat model for ${providerName}:`, error);
      // Return a minimal valid model object on error
      return {
        name: 'default',
        label: 'Default Model',
        contextWindow: 8192,
        maxTokens: 4000,
        defaultMaxTokens: 4000,
        inputPrice: 0,
        outputPrice: 0,
        isDefault: true,
        group: 'Open Source'
      } as IChatModel;
    }
  }

  function getChatModels(providerName: ProviderType): IChatModel[] {
    const provider = getProvider(providerName);
    
    // Handle case where provider is undefined
    if (!provider) {
      console.error(`Provider not found: ${providerName}`);
      return [];
    }
    
    // Handle case where provider doesn't have chat property or models
    if (!provider.chat || !provider.chat.models) {
      console.error(`Provider ${providerName} is missing chat or models configuration`);
      return [];
    }
    
    return Object.keys(provider.chat.models).map((modelKey) => {
      const model = provider.chat.models[modelKey];
      model.label = modelKey;
      return model;
    });
  }

  function getChatModel(
    providerName: ProviderType,
    modelLabel: string
  ): IChatModel {
    // Use the requested provider
    const provider = getProvider(providerName);
    
    // First try direct lookup by key
    let model = provider.chat.models[modelLabel];
    
    // If not found, try to find by name
    if (!model) {
      // Look through all models to find one with matching name
      for (const key in provider.chat.models) {
        const currentModel = provider.chat.models[key];
        if (currentModel.name === modelLabel || currentModel.label === modelLabel) {
          model = currentModel;
          break;
        }
      }
      
      // If still not found, return default model
      if (!model) {
        model = getDefaultChatModel(providerName);
      }
    }
    
    // Always ensure the model has a label
    model.label = model.label || modelLabel;
    
    return model;
  }

  return {
    getProviders,
    getProvider,
    getChatModels,
    getChatModel,
    getDefaultChatModel,
  };
}
