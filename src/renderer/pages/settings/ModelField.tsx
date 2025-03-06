import {
  Dropdown,
  Input,
  Label,
  Option,
  Button,
  Tooltip,
  Switch,
  SwitchOnChangeData,
} from '@fluentui/react-components';
import { useTranslation } from 'react-i18next';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import useProvider from 'hooks/useProvider';
import { Info16Regular } from '@fluentui/react-icons';
import TooltipIcon from 'renderer/components/TooltipIcon';
import ToolStatusIndicator from 'renderer/components/ToolStatusIndicator';
import OnlineStatusIndicator from 'renderer/components/OnlineStatusIndicator';
import ReasoningStatusIndicator from 'renderer/components/ReasoningStatusIndicator';
import FastResponseStatusIndicator from 'renderer/components/FastResponseStatusIndicator';
import UncensoredStatusIndicator from 'renderer/components/UncensoredStatusIndicator';
import MuricaStatusIndicator from 'renderer/components/MuricaStatusIndicator';
import ArjunsFavoriteStatusIndicator from 'renderer/components/ArjunsFavoriteStatusIndicator';
import LongContextStatusIndicator from 'renderer/components/LongContextStatusIndicator';
import { isUndefined } from 'lodash';
import OllamaModelPicker from './OllamaModelPicker';
import { IChatModel, IServiceProvider } from '../../../providers/types';
import useSettingsStore from '../../../stores/useSettingsStore';

export default function ModelField({
  provider,
}: {
  provider: IServiceProvider;
}) {
  const { t } = useTranslation();
  const model = useSettingsStore((state) => state.api.model);
  const baseUrl = useSettingsStore((state) => state.api.base);
  const { getChatModels } = useProvider();
  const { setAPI, setToolState, getToolState, toolStates } = useSettingsStore();
  const { getDefaultChatModel } = useProvider();
  const [toolEnabled, setToolEnabled] = useState(
    getToolState(provider.name, model) || false,
  );

  const models = useMemo(() => {
    return getChatModels(provider.name);
  }, [provider]);

  const curModelLabel = useMemo(() => {
    return models.find((m) => m.name === model)?.label || '';
  }, [model, models]);

  useEffect(() => {
    if (provider) {
      const defaultModel = getDefaultChatModel(provider.name).name || '';
      const modelExists = !!models.find(m => m.name === model);
      if (!model || !modelExists) {
        setAPI({
          model: defaultModel
        });
      }
    }
  }, [provider]);

  useEffect(() => {
    if (provider && model) {
      let newToolEnabled = getToolState(provider.name, model);
      if (isUndefined(newToolEnabled)) {
        const curModel = models.find((m) => m.name === model);
        newToolEnabled = curModel?.toolEnabled || false;
      }
      setToolEnabled(newToolEnabled);
    }
  }, [provider, model, toolStates]);

  const onOptionSelect = (ev: any, data: any) => {
    setAPI({ model: data.optionValue });
  };

  const onInput = (evt: any) => {
    setAPI({ model: evt.target.value });
    
    // For Ollama, store the model in a dedicated key for persistence
    if (provider.name === 'Ollama') {
      console.log(`Saving Ollama model directly: ${evt.target.value}`);
      window.electron.store.set('settings.ollama.currentModel', evt.target.value);
    }
  };

  const setModel = (_model: string) => {
    setAPI({ model: _model });
    
    // For Ollama, store the model in a dedicated key for persistence
    if (provider.name === 'Ollama') {
      console.log(`Saving Ollama model directly from picker: ${_model}`);
      window.electron.store.set('settings.ollama.currentModel', _model);
    }
  };

  const setToolSetting = (
    _: ChangeEvent<HTMLInputElement>,
    data: SwitchOnChangeData,
  ) => {
    setToolState(provider.name, model, data.checked);
  };

  const renderOllamaModelPicker = useCallback(
    () =>
      provider.name === 'Ollama' && (
        <div className="absolute right-1 top-1">
          <OllamaModelPicker baseUrl={baseUrl} onConfirm={setModel} />
        </div>
      ),
    [provider, baseUrl],
  );

  return (
    // Only show the model field if the provider is not OMNI
    provider.name !== 'OMNI' ? (
      <div className="flex justify-start items-center my-3.5 gap-1">
        <div className="w-72">
          <div className="flex justify-start items-center mb-1.5 w-full">
            <Label htmlFor="model">{t('Common.Model')}</Label>
            <TooltipIcon tip={t(provider.chat.docs?.model || '')} />
          </div>
          
          {/* Special handling for Ollama/OMNI Edge */}
          {provider.name === 'Ollama' ? (
            <div className="w-full mb-2">
              <div className="flex flex-col w-full gap-2">
                <div className="text-sm mb-1 dark:text-white">
                  {t('Common.Model')}: <span className="font-medium">{model || t('Common.None')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="w-full"
                    value={model}
                    onChange={onInput}
                    placeholder={t('Common.EnterModelName')}
                  />
                  <OllamaModelPicker baseUrl={baseUrl} onConfirm={setModel} />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('Common.ClickChooseModels')}
                </div>
              </div>
            </div>
          ) : (
            // Standard model selection for other providers
            <div className="w-full">
              {models.length > 0 ? (
                models.length === 1 ? (
                  <div className="flex flex-row justify-start items-center gap-1 w-full">
                    <OnlineStatusIndicator
                      provider={provider.name}
                      providerDisplayName={provider.displayName}
                      model={models[0].name}
                      withTooltip
                    />
                    <ReasoningStatusIndicator
                      provider={provider.name}
                      providerDisplayName={provider.displayName}
                      model={models[0].name}
                      withTooltip
                    />
                    <FastResponseStatusIndicator
                      provider={provider.name}
                      providerDisplayName={provider.displayName}
                      model={models[0].name}
                      withTooltip
                    />
                    <ToolStatusIndicator
                      provider={provider.name}
                      providerDisplayName={provider.displayName}
                      model={models[0].name}
                      withTooltip
                    />
                    <UncensoredStatusIndicator
                      provider={provider.name}
                      providerDisplayName={provider.displayName}
                      model={models[0].name}
                      withTooltip
                    />
                    <MuricaStatusIndicator
                      provider={provider.name}
                      providerDisplayName={provider.displayName}
                      model={models[0].name}
                      withTooltip
                    />
                    <ArjunsFavoriteStatusIndicator
                      provider={provider.name}
                      providerDisplayName={provider.displayName}
                      model={models[0].name}
                      withTooltip
                    />
                    <LongContextStatusIndicator
                      model={models[0].name}
                      provider={provider.name}
                      providerDisplayName={provider.displayName}
                      withTooltip={true}
                    />
                    <span className="latin">{models[0].label}</span>
                    {models[0].description && (
                      <Tooltip
                        content={models[0].description as string}
                        relationship="label"
                      >
                        <Button
                          icon={<Info16Regular />}
                          size="small"
                          appearance="subtle"
                        />
                      </Tooltip>
                    )}
                  </div>
                ) : (
                  <Dropdown
                    aria-labelledby="model"
                    className="w-full"
                    value={curModelLabel}
                    selectedOptions={[model]}
                    onOptionSelect={onOptionSelect}
                  >
                    {models.map((model: IChatModel) => (
                      <Option
                        key={model.name as string}
                        text={model.label as string}
                        value={model.name as string}
                      >
                        <div className="flex justify-start items-baseline latin">
                          <div className="flex justify-start items-baseline gap-1">
                            <OnlineStatusIndicator
                              provider={provider.name}
                              providerDisplayName={provider.displayName}
                              model={model.name}
                              withTooltip
                            />
                            <ReasoningStatusIndicator
                              provider={provider.name}
                              providerDisplayName={provider.displayName}
                              model={model.name}
                              withTooltip
                            />
                            <FastResponseStatusIndicator
                              provider={provider.name}
                              providerDisplayName={provider.displayName}
                              model={model.name}
                              withTooltip
                            />
                            <ToolStatusIndicator
                              provider={provider.name}
                              providerDisplayName={provider.displayName}
                              model={model.name}
                              withTooltip
                            />
                            <UncensoredStatusIndicator
                              provider={provider.name}
                              providerDisplayName={provider.displayName}
                              model={model.name}
                              withTooltip
                            />
                            <MuricaStatusIndicator
                              provider={provider.name}
                              providerDisplayName={provider.displayName}
                              model={model.name}
                              withTooltip
                            />
                            <ArjunsFavoriteStatusIndicator
                              provider={provider.name}
                              providerDisplayName={provider.displayName}
                              model={model.name}
                              withTooltip
                            />
                            <LongContextStatusIndicator
                              model={model.name}
                              provider={provider.name}
                              providerDisplayName={provider.displayName}
                              withTooltip={true}
                            />
                            <span className="latin">{model.label}</span>
                            {model.description && (
                              <Tooltip
                                content={model.description as string}
                                relationship="label"
                              >
                                <Button
                                  icon={<Info16Regular />}
                                  size="small"
                                  appearance="subtle"
                                />
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </Option>
                    ))}
                  </Dropdown>
                )
              ) : provider.chat.options.modelCustomizable ? (
                <div className="relative w-full">
                  <Input
                    className="w-full"
                    value={model}
                    onChange={onInput}
                    placeholder={t('Common.EnterModelName')}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
        {provider.chat.options.modelCustomizable &&
          model &&
          provider.chat.models[model]?.toolEnabled && (
            <div className="ml-4">
              <div className="flex justify-start items-center mb-1.5">
                <Label htmlFor="enableTool">{t('Settings.EnableTool')}</Label>
                <TooltipIcon tip={t('Settings.EnableToolTip')} />
              </div>
              <Switch
                checked={toolEnabled}
                onChange={setToolSetting}
                label={t('Settings.EnableTool')}
                labelPosition="after"
              />
            </div>
          )}
      </div>
    ) : null
  );
}

