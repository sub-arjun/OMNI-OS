import { ChangeEvent, useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dropdown,
  Input,
  InputOnChangeData,
  Label,
  Option,
  Button,
} from '@fluentui/react-components';
import { Premium16Regular, Save16Regular } from '@fluentui/react-icons';
import useSettingsStore from '../../../stores/useSettingsStore';
import ModelField from './ModelField';
import { IServiceProvider } from '../../../providers/types';
import MaskableInput from 'renderer/components/MaskableInput';
import useProvider from 'hooks/useProvider';
import useAuthStore from 'stores/useAuthStore';
import TooltipIcon from 'renderer/components/TooltipIcon';
import ModelMappingButton from './ModelMappingButton';
import supabase from 'vendors/supa';
import useToast from 'hooks/useToast';
import { captureException } from 'renderer/logging';

export default function APISettings() {
  const { t } = useTranslation();
  const api = useSettingsStore((state) => state.api);
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const setAPI = useSettingsStore((state) => state.setAPI);
  const { getProviders, getProvider, getDefaultChatModel } = useProvider();
  const providers = useMemo(() => getProviders(), []);
  const [provider, setProvider] = useState<IServiceProvider>(
    Object.values(providers)[0]
  );
  const [saving, setSaving] = useState(false);
  const { notifyInfo, notifyError, notifySuccess } = useToast();

  useEffect(() => {
    const provider = getProvider(api.provider);
    setProvider(provider);
    
    // Special handling for Ollama to initialize with the dedicated storage value
    if (provider.name === 'Ollama') {
      const ollamaModel = window.electron?.store?.get('settings.ollama.currentModel', null);
      if (ollamaModel && ollamaModel !== api.model) {
        console.log(`Initializing Ollama API with model from dedicated storage: ${ollamaModel}`);
        // Update the API config with the model from dedicated storage
        setAPI({ model: ollamaModel });
        // Skip the provider change to avoid resetting the model
        return;
      }
    }
    
    onAPIProviderChange(null, { optionValue: provider.name });
  }, [api.provider, session]);

  const onAPIProviderChange = (ev: any, data: any) => {
    try {
      if (!data || !data.optionValue) {
        console.error('No provider option value provided');
        return;
      }
      
      console.log(`Attempting to switch to provider: ${data.optionValue}`);
      
      // Special handling for OMNI Edge
      const providerKey = data.optionValue === 'OMNI Edge' ? 'Ollama' : data.optionValue;
      console.log(`Looking up provider with key: ${providerKey}`);
      
      const $provider = getProvider(providerKey);
      console.log(`Provider data:`, $provider);
      
      const defaultModel = getDefaultChatModel(providerKey);
      console.log(`Default model for ${data.optionValue}:`, defaultModel);
      
      const apiConfig = window.electron.store.get(
        `settings.api.providers.${providerKey}`,
        {
          provider: data.optionValue,  // Keep the display name
          base: $provider.apiBase || '',
          model: defaultModel?.name || '',
          key: '',
        }
      );
      console.log(`API config before updates:`, apiConfig);

      if (data.optionValue === 'OMNI') {
        apiConfig.base = $provider.apiBase || 'https://openrouter.ai'; 
      } else if (data.optionValue === 'OMNI Edge' || data.optionValue === 'Ollama') {
        apiConfig.base = $provider.apiBase || 'http://127.0.0.1:11434';
        
        // Check for saved Ollama model in dedicated storage
        const savedOllamaModel = window.electron.store.get('settings.ollama.currentModel', null);
        
        // Ensure a valid model is set for Ollama
        if (savedOllamaModel) {
          console.log(`Using saved Ollama model from dedicated storage: ${savedOllamaModel}`);
          apiConfig.model = savedOllamaModel;
        } else if (!apiConfig.model || apiConfig.model === 'default' || apiConfig.model === 'local') {
          console.log('Setting a proper default model for Ollama');
          const defaultOllamaModel = 'llama3';
          apiConfig.model = defaultOllamaModel;
          // Save to dedicated storage
          window.electron.store.set('settings.ollama.currentModel', defaultOllamaModel);
        } else {
          // Save current model to dedicated storage
          window.electron.store.set('settings.ollama.currentModel', apiConfig.model);
        }
      } else {
        apiConfig.base = $provider.apiBase || '';
      }

      if ($provider.isPremium) {
        apiConfig.key = '';
      }
      
      if (
        $provider.chat && 
        $provider.chat.models && 
        Object.keys($provider.chat.models).length &&
        !$provider.chat.models[apiConfig.model]
      ) {
        apiConfig.model = defaultModel?.name || '';
      }
      
      console.log(`Final API config to be set:`, apiConfig);
      setAPI(apiConfig);
      console.log(`Provider switched to: ${data.optionValue}`);
    } catch (error) {
      console.error('Error in onAPIProviderChange:', error);
      // Do NOT fallback to OMNI, instead maintain current state
      // This allows users to actually switch to their desired provider
    }
  };

  const onAPIBaseChange = (
    _: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setAPI({ base: data.value });
  };

  const onAPIKeyChange = (
    _: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setAPI({ key: data.value });
  };

  const onAPISecretChange = (
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setAPI({ secret: data.value });
  };

  const onDeploymentIdChange = (
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setAPI({ deploymentId: data.value });
  };

  const saveToCloud = async () => {
    if (!user) {
      notifyInfo(t('Auth.Notification.SignInRequired'));
      return;
    }
    setSaving(true);
    try {
      const { theme, api } = useSettingsStore.getState();
      const encrypted = await window.electron.crypto.encrypt(
        JSON.stringify({ theme, api }),
        user.id
      );
      const { error } = await supabase
        .from('settings')
        .upsert({ data: encrypted, id: user.id });
      if (error) {
        notifyError(error.message);
      } else {
        notifySuccess(t('Settings.Notification.SaveToCloudSuccess'));
      }
    } catch (error) {
      console.error(error);
      captureException(error as Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section--header">{t('Common.API')}</div>
      <div className="py-5 flex-grow">
        <div>
          <Label htmlFor="provider" className="block mb-1.5">
            {t('Common.Provider')}
          </Label>
          <div>
            <Dropdown
              id="provider"
              className="w-56 latin"
              value={api.provider}
              selectedOptions={[api.provider]}
              onOptionSelect={onAPIProviderChange}
            >
              {Object.values(providers).map((provider: IServiceProvider) => {
                // Use displayName for Ollama provider to show as "OMNI Edge"
                const displayText = provider.displayName || provider.name;
                
                return (
                  <Option key={provider.name} text={displayText}>
                    <div className="flex justify-between w-full gap-2 latin">
                      {displayText}
                      {provider.isPremium ? (
                        <div className="flex justify-start items-center gap-1 text-xs">
                          <Premium16Regular className="text-purple-600" />
                        </div>
                      ) : (
                        ''
                      )}
                    </div>
                  </Option>
                );
              })}
            </Dropdown>
          </div>
        </div>
        {provider.options.apiBaseCustomizable && provider.name !== 'OMNI' && (
          <div className="my-3.5">
            <div className="flex justify-start items-center mb-1.5">
              <Label htmlFor="apiBase">{t('Common.APIBase')}</Label>
              <TooltipIcon tip={t(provider.chat.docs?.base||'')} />
            </div>
            <div>
              <Input
                id="apiBase"
                className="w-4/5 min-w-fit"
                disabled={!provider.options.apiBaseCustomizable}
                placeholder={provider.chat.placeholders?.base || provider.apiBase}
                value={api.base}
                onChange={onAPIBaseChange}
              />
            </div>
          </div>
        )}
        {provider.options.apiKeyCustomizable && (
          <div className="my-3.5">
            <div className="flex justify-start items-center mb-1.5">
              <Label htmlFor="apiKey" className="block">
                {t('Common.APIKey')}
              </Label>
              <TooltipIcon tip={t(provider.chat.docs?.key||'')} />
            </div>
            <div>
              <MaskableInput
                id="apiKey"
                className="w-4/5 min-w-fit"
                value={api.key}
                disabled={!provider.options.apiKeyCustomizable}
                onChange={onAPIKeyChange}
              />
            </div>
            <div className="mt-2">
              <Button 
                appearance="primary"
                size="small"
                icon={<Save16Regular />}
                onClick={saveToCloud}
                disabled={saving || !user}
              >
                {saving ? t('Common.Waiting') : t('Common.Save')}
              </Button>
            </div>
          </div>
        )}
        {['Azure', 'Doubao'].includes(provider.name) ? (
          <div className="my-3.5">
            <div className="flex justify-start items-center mb-1.5">
              <Label htmlFor="deploymentId">
                {t(`${provider.name}.DeploymentID`)}
              </Label>
              <TooltipIcon tip={t(provider.chat.docs?.deploymentId||'')} />
            </div>
            <Input
              value={api.deploymentId || ''}
              placeholder={t(provider.chat.placeholders?.deploymentId || '')}
              onChange={onDeploymentIdChange}
              className="w-4/5 min-w-fit"
            />
          </div>
        ) : null}
        {provider.name === 'Baidu' ? (
          <div className="my-3.5">
            <div className="flex justify-start items-center mb-1.5">
              <Label htmlFor="apiSecret">{t('Common.SecretKey')}</Label>
              <TooltipIcon tip={t(provider.chat.docs?.key||'')} />
            </div>
            <MaskableInput
              id="apiSecret"
              className="w-4/5 min-w-fit"
              placeholder={t(provider.chat.placeholders?.secret || '')}
              value={api.secret}
              onChange={onAPISecretChange}
            />
          </div>
        ) : null}
        <ModelField provider={provider} />
        {provider.description && (
          <div className="tips">
            {provider.description}
          </div>
        )}
        {provider.name !== 'OMNI' && <ModelMappingButton />}
      </div>
    </div>
  );
}
