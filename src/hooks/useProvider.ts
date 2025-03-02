import { providers } from '../providers';
import { IChatModel, IServiceProvider, ProviderType } from 'providers/types';
import useAuthStore from 'stores/useAuthStore';
import useSettingsStore from 'stores/useSettingsStore';

export default function useProvider() {
  // Don't access store states directly here, as it can cause issues before store initialization
  // Instead, access them inside the functions where they're actually needed

  function getProviders(arg?:{withDisabled:boolean}): { [key: string]: IServiceProvider } {
    // Only show OMNI provider in the frontend
    // Filter out all providers except OMNI, but keep their code available
    return Object.values(providers).reduce(
      (acc: { [key: string]: IServiceProvider }, cur: IServiceProvider) => {
        // Only allow OMNI provider to be shown in the frontend
        if (cur.name === 'OMNI') {
          acc[cur.name] = cur;
        }
        return acc;
      },
      {} as { [key: string]: IServiceProvider }
    );
  }

  function getProvider(providerName: ProviderType): IServiceProvider {
    const allProviders = getProviders();
    // Always return OMNI provider, even if another provider is requested
    return allProviders['OMNI'];
  }

  function getDefaultChatModel(provider: ProviderType): IChatModel {
    const models = getChatModels(provider)
    if(models.length === 0) return {} as IChatModel;
    const defaultModel = models.filter((m: IChatModel) => m.isDefault)[0];
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
    // Always use OMNI provider regardless of requested provider
    const omniProvider = getProvider('OMNI')    
    // First try direct lookup by key
    let model = omniProvider.chat.models[modelLabel];
    
    // If not found, try to find by name
    if (!model) {
      // Look through all models to find one with matching name
      for (const key in omniProvider.chat.models) {
        const currentModel = omniProvider.chat.models[key];
        if (currentModel.name === modelLabel || currentModel.label === modelLabel) {
          model = currentModel;
          break;
        }
      }
      
      // If still not found, return default model
      if (!model) {
        model = getDefaultChatModel('OMNI');
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
