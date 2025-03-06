import {
  Button,
  Field,
  Menu,
  MenuDivider,
  MenuGroupHeader,
  MenuItemCheckbox,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Switch,
  SwitchOnChangeData,
  Text,
  Tooltip,
  MenuCheckedValueChangeData,
  SwitchProps,
} from '@fluentui/react-components';
import type { MenuCheckedValueChangeEvent } from '@fluentui/react-components';
import { ChevronDown16Regular, Info16Regular } from '@fluentui/react-icons';
import Mousetrap from 'mousetrap';
import { IChat, IChatContext } from 'intellichat/types';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useChatStore from 'stores/useChatStore';
import useSettingsStore from 'stores/useSettingsStore';
import { IChatModel, ProviderType } from 'providers/types';
import useProvider from 'hooks/useProvider';
import useAuthStore from 'stores/useAuthStore';
import ToolStatusIndicator from 'renderer/components/ToolStatusIndicator';
import SearchStatusIndicator from 'renderer/components/SearchStatusIndicator';
import ReasoningStatusIndicator from 'renderer/components/ReasoningStatusIndicator';
import FastResponseStatusIndicator from 'renderer/components/FastResponseStatusIndicator';
import UncensoredStatusIndicator from 'renderer/components/UncensoredStatusIndicator';
import MuricaStatusIndicator from 'renderer/components/MuricaStatusIndicator';
import ArjunsFavoriteStatusIndicator from 'renderer/components/ArjunsFavoriteStatusIndicator';
import LongContextStatusIndicator from 'renderer/components/LongContextStatusIndicator';
import SecureStatusIndicator from 'renderer/components/SecureStatusIndicator';
import { isUndefined } from 'lodash';

// Custom styled Switch component with green color when checked
const GreenSwitch = (props: SwitchProps) => {
  return (
    <Switch 
      {...props}
      className={`${props.className || ''} ${props.checked ? 'green-switch' : ''}`}
      style={{
        ...(props.style || {}),
        ...(props.checked ? {
          '--switch-indicator-checked-background': '#2ecc71',
          '--switch-indicator-checked-border': '#27ae60',
          '--colorCompoundBrandBackground': '#2ecc71',
          '--colorBrandBackground': '#2ecc71',
          '--colorNeutralForegroundOnBrand': '#ffffff',
          '--colorBrandBackgroundHover': '#27ae60',
          '--colorBrandBackgroundPressed': '#27ae60',
          '--colorCompoundBrandBackgroundHover': '#27ae60',
          '--colorCompoundBrandBackgroundPressed': '#27ae60',
        } as React.CSSProperties : {})
      }}
    />
  );
};

export default function ModelCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const api = useSettingsStore((state) => state.api);
  const modelMapping = useSettingsStore((state) => state.modelMapping);
  const { getToolState, setToolState } = useSettingsStore();
  const autoEnabled = useSettingsStore((state) => state.autoEnabled);
  const setAutoEnabled = useSettingsStore((state) => state.setAutoEnabled);
  const session = useAuthStore((state) => state.session);
  const { getProvider, getChatModels } = useProvider();
  const [providerName, setProviderName] = useState<ProviderType>(api.provider);
  const editStage = useChatStore((state) => state.editStage);

  const allModels = useMemo<IChatModel[]>(() => {
    if (!api.provider || api.provider === 'Azure') return [];
    const provider = getProvider(api.provider);
    setProviderName(provider.name);
    if (provider.chat.options.modelCustomizable) {
      return getChatModels(provider.name) || [];
    }
    return [];
  }, [api.provider, session]);

  const autoModel = useMemo(() => {
    return allModels.find(model => model.autoEnabled === true);
  }, [allModels]);

  const models = useMemo<IChatModel[]>(() => {
    // Always show only the auto model
    if (autoModel) {
      return [autoModel];
    }
    // Fallback to empty array if no auto model is found
    return [];
  }, [allModels, autoModel]);

  const activeModel = useMemo(() => ctx.getModel(), [chat.model]);

  // Set autoEnabled to true by default
  useEffect(() => {
    if (!autoEnabled && autoModel) {
      setAutoEnabled(true);
    }
  }, [autoEnabled, autoModel, setAutoEnabled]);

  const onModelChange = (
    _: MenuCheckedValueChangeEvent,
    data: MenuCheckedValueChangeData,
  ) => {
    const $model = data.checkedItems[0];
    editStage(chat.id, { model: $model });
    window.electron.ingestEvent([{ app: 'switch-model' }, { model: $model }]);
    // Close dialog when changing model selection
    closeDialog();
  };

  const toggleDialog = () => {
    if (open) {
      closeDialog();
    } else {
      openDialog();
    }
  };

  const openDialog = () => {
    setOpen(true);
    Mousetrap.bind('esc', closeDialog);
  };

  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind('esc');
  };

  useEffect(() => {
    if (models.length > 0) {
      Mousetrap.bind('mod+shift+1', toggleDialog);
    }
    return () => {
      Mousetrap.unbind('mod+shift+1');
    };
  }, [models]);

  return models && models.length ? (
    <Menu
      hasCheckmarks
      open={open}
      onCheckedValueChange={onModelChange}
      checkedValues={{ model: [activeModel.label as string] }}
    >
      <MenuTrigger disableButtonEnhancement>
        <Button
          aria-label={t('Common.Model')}
          size="small"
          appearance="subtle"
          iconPosition="after"
          icon={<ChevronDown16Regular />}
          title="Mod+Shift+1"
          onClick={toggleDialog}
          style={{ borderColor: 'transparent', boxShadow: 'none', padding: 1 }}
          className="text-color-secondary flex justify-start items-center"
        >
          {autoEnabled && autoModel && activeModel.autoEnabled ? (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <SecureStatusIndicator
                  provider={providerName}
                  withTooltip={true}
                />
                <ToolStatusIndicator
                  provider={providerName}
                  model={activeModel.name}
                  withTooltip={true}
                />
              </div>
              <span className="text-color-secondary">OMNI /</span>
              <span className="font-medium">AUTO</span>
              <span className="text-color-secondary"> 🪄</span>
            </div>
          ) : (
            <div className="flex items-center">
              <div className="flex flex-row justify-start items-center mr-1">
                <div style={{ display: 'flex', width: '68px', justifyContent: 'flex-start' }}>
                  <SecureStatusIndicator
                    provider={providerName}
                    withTooltip={true}
                  />
                  <SearchStatusIndicator
                    provider={providerName}
                    model={activeModel.name}
                    withTooltip={true}
                  />
                  <ReasoningStatusIndicator
                    provider={providerName}
                    model={activeModel.name}
                    withTooltip={true}
                  />
                  <FastResponseStatusIndicator
                    provider={providerName}
                    model={activeModel.name}
                    withTooltip={true}
                  />
                  <ToolStatusIndicator
                    provider={providerName}
                    model={activeModel.name}
                    withTooltip={true}
                  />
                  <UncensoredStatusIndicator
                    provider={providerName}
                    model={activeModel.name}
                    withTooltip={true}
                  />
                  <MuricaStatusIndicator
                    provider={providerName}
                    model={activeModel.name}
                    withTooltip={true}
                  />
                  <ArjunsFavoriteStatusIndicator
                    provider={providerName}
                    model={activeModel.name}
                    withTooltip={true}
                  />
                  <LongContextStatusIndicator
                    model={activeModel.name}
                    provider={providerName}
                    withTooltip={true}
                  />
                </div>
              </div>
              <div className="flex-shrink overflow-hidden whitespace-nowrap text-ellipsis min-w-12">
                <span className="text-color-secondary">{providerName} /</span>
                <span className="font-medium">{activeModel.label}</span>
                {modelMapping[activeModel.label || ''] && (
                  <span className="text-gray-300 dark:text-gray-400">
                    ‣{modelMapping[activeModel.label || '']}
                  </span>
                )}
              </div>
            </div>
          )}
          {activeModel.description && (
            <Tooltip
              content={activeModel.description as string}
              relationship="label"
            >
              <Button
                icon={<Info16Regular />}
                size="small"
                appearance="subtle"
              />
            </Tooltip>
          )}
        </Button>
      </MenuTrigger>
      <MenuPopover className="model-menu-popup">
        <MenuList style={{ width: '450px' }}>
          {autoModel && (
            <div className="px-2 py-2 mb-2">
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <SecureStatusIndicator
                      provider={providerName}
                      withTooltip={true}
                    />
                    <ToolStatusIndicator
                      provider={providerName}
                      model={autoModel?.name || ''}
                      withTooltip={true}
                    />
                    <span style={{ fontSize: '1rem', fontWeight: 500, textAlign: 'center' }}>&nbsp;&nbsp;✨ AUTO ✨</span>
                  </div>
                </div>
                <div style={{ paddingLeft: '4px' }}>
                  <span style={{ fontSize: '0.9rem' }}>Automatically selects the best advanced AI model for your task</span>
                </div>
                <div style={{ paddingLeft: '4px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>Optimized for:</span>
                  <div style={{ display: 'flex', gap: '12px', marginLeft: '4px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: 500 }}>Performance</span>
                    <span style={{ color: '#9ca3af' }}>•</span>
                    <span style={{ fontSize: '0.9rem', color: '#0891b2', fontWeight: 500 }}>Speed</span>
                    <span style={{ color: '#9ca3af' }}>•</span>
                    <span style={{ fontSize: '0.9rem', color: '#059669', fontWeight: 500 }}>Cost</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
              <div className="px-1 text-sm text-gray-400 dark:text-gray-500">
                <p className="text-gray-400 dark:text-gray-500 mb-3">Use the specialized model buttons for specific tasks:</p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-purple-500 dark:text-purple-400 text-lg mr-2">🔍</span>
                    <div>
                      <div className="font-medium text-gray-700 dark:text-gray-300">DeepSearch</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">For internet research & factual inquiries</div>
                    </div>
                  </div>
                  <div className="flex items-start p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-rose-500 dark:text-rose-400 text-lg mr-2">💭</span>
                    <div>
                      <div className="font-medium text-gray-700 dark:text-gray-300">DeepThought</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">For complex reasoning & analysis</div>
                    </div>
                  </div>
                  <div className="flex items-start p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-orange-500 dark:text-orange-400 text-lg mr-2">⚡</span>
                    <div>
                      <div className="font-medium text-gray-700 dark:text-gray-300">Flash</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">For speed and processing long documents</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </MenuList>
      </MenuPopover>
    </Menu>
  ) : (
    <Text size={200}>
      {autoEnabled && autoModel && activeModel.autoEnabled ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <SecureStatusIndicator
              provider={providerName}
              withTooltip={true}
            />
            <ToolStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
          </div>
          <span className="text-color-secondary">OMNI /</span>
          <span className="font-medium">AUTO</span>
          <span className="text-color-secondary"> 🪄</span>
        </div>
      ) : (
        <span className="flex justify-start items-center gap-1">
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <SecureStatusIndicator
              provider={providerName}
              withTooltip={true}
            />
            <SearchStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
            <ReasoningStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
            <FastResponseStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
            <ToolStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
            <UncensoredStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
            <MuricaStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
            <ArjunsFavoriteStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
            <LongContextStatusIndicator
              model={activeModel.name}
              provider={providerName}
              withTooltip={true}
            />
          </div>
          <span className="text-color-secondary">{providerName} /</span>
          <span className="font-medium">{activeModel.label}</span>
          {modelMapping[activeModel.label || ''] && (
            <span className="text-gray-300 dark:text-gray-400 -ml-1">
              ‣{modelMapping[activeModel.label || '']}
            </span>
          )}
        </span>
      )}
    </Text>
  );
}




