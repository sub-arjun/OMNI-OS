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
          acc[cur.name] = cur;
        }
        return acc;
      },
      {} as { [key: string]: IServiceProvider }
    );
  }

  function getProvider(providerName: ProviderType): IServiceProvider {
    // Return the actual requested provider
    return providers[providerName];
  }

  function getDefaultChatModel(providerName: ProviderType): IChatModel {
    // Get all models for the provider
    const models = getChatModels(providerName);
    
    if (models.length === 0) {
      return {} as IChatModel;
    }
    
    // Find a model marked as default, or use the first one
    const defaultModel = models.find((m: IChatModel) => m.isDefault);
    return defaultModel || models[0];
  }

  function getChatModels(providerName: ProviderType): IChatModel[] {
    const provider = getProvider(providerName);
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
