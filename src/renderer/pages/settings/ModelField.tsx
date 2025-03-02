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
      setAPI({
        model: model || defaultModel,
      });
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
  };

  const setModel = (_model: string) => {
    setAPI({ model: _model });
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
    [provider],
  );

  return (
    <div className="flex justify-start items-center my-3.5 gap-1">
      <div className="w-72">
        <div className="flex justify-start items-center mb-1.5 w-full">
          <Label htmlFor="model">{t('Common.Model')}</Label>
          <TooltipIcon tip={t(provider.chat.docs?.model || '')} />
        </div>
        <div className="w-full">
          {models.length > 0 ? (
            models.length === 1 ? (
              <div className="flex flex-row justify-start items-center gap-1 w-full">
                <OnlineStatusIndicator
                  provider={provider.name}
                  model={models[0].name}
                  withTooltip
                />
                <ReasoningStatusIndicator
                  provider={provider.name}
                  model={models[0].name}
                  withTooltip
                />
                <FastResponseStatusIndicator
                  provider={provider.name}
                  model={models[0].name}
                  withTooltip
                />
                <ToolStatusIndicator
                  provider={provider.name}
                  model={models[0].name}
                  withTooltip
                />
                <UncensoredStatusIndicator
                  provider={provider.name}
                  model={models[0].name}
                  withTooltip
                />
                <MuricaStatusIndicator
                  provider={provider.name}
                  model={models[0].name}
                  withTooltip
                />
                <ArjunsFavoriteStatusIndicator
                  provider={provider.name}
                  model={models[0].name}
                  withTooltip
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
                          model={model.name}
                          provider={provider.name}
                        />
                        <ReasoningStatusIndicator
                          model={model.name}
                          provider={provider.name}
                          withTooltip
                        />
                        <FastResponseStatusIndicator
                          model={model.name}
                          provider={provider.name}
                          withTooltip
                        />
                        <ToolStatusIndicator
                          model={model.name}
                          provider={provider.name}
                        />
                        <UncensoredStatusIndicator
                          model={model.name}
                          provider={provider.name}
                          withTooltip
                        />
                        <MuricaStatusIndicator
                          model={model.name}
                          provider={provider.name}
                          withTooltip
                        />
                        <ArjunsFavoriteStatusIndicator
                          model={model.name}
                          provider={provider.name}
                          withTooltip
                        />
                        <span className="latin">{model.label as string}</span>
                      </div>
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
                  </Option>
                ))}
              </Dropdown>
            )
          ) : (
            <div className="flex flex-grow justify-start items-center gap-1 relative">
              {provider.chat.options.modelCustomizable && (
                <Input
                  value={model || ''}
                  placeholder={t(
                    provider.chat.placeholders?.deploymentId || '',
                  )}
                  onInput={onInput}
                  className="w-full"
                />
              )}

              {renderOllamaModelPicker()}
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="flex justify-start items-center">
          <Label>{t('Common.Tools')}</Label>
          <TooltipIcon tip={t('Common.SupportToolsTip')} />
        </div>
        <div className="flex justify-start items-center gap-1 -mb-1.5">
          <Switch checked={toolEnabled} onChange={setToolSetting} />
        </div>
      </div>
    </div>
  );
}

