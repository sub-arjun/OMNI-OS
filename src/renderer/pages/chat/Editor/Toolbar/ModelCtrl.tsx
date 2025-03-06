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
import { Info16Regular } from '@fluentui/react-icons';
import Mousetrap from 'mousetrap';
import { IChat, IChatContext } from 'intellichat/types';
import { useEffect, useMemo, useState, useRef } from 'react';
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
import SecureStatusIndicator from '../../../../components/SecureStatusIndicator';
import RouterStatusIndicator from '../../../../components/RouterStatusIndicator';
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

  // Add hook for dark mode text styling
  useEffect(() => {
    // Apply white text for dark mode elements
    const style = document.createElement('style');
    style.textContent = `
      @media (prefers-color-scheme: dark) {
        [data-dark-mode-text="true"] {
          color: white !important;
        }
        
        .force-white-text.dark\\:text-white,
        .force-white-text .dark\\:text-white:not(.text-green-700):not(.dark\\:text-green-300) {
          color: white !important;
        }
      }
      
      html.dark [data-dark-mode-text="true"] {
        color: white !important;
      }
      
      html.dark .force-white-text.dark\\:text-white,
      html.dark .force-white-text .dark\\:text-white:not(.text-green-700):not(.dark\\:text-green-300) {
        color: white !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
          title="Mod+Shift+1"
          onClick={toggleDialog}
          style={{ borderColor: 'transparent', boxShadow: 'none', padding: 1 }}
          className="text-gray-900 dark:text-white flex justify-start items-center"
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
                <RouterStatusIndicator
                  provider={providerName}
                  model={activeModel.name}
                  withTooltip={true}
                />
              </div>
              <span className="text-gray-700 dark:text-gray-200">OMNI /</span>
              <span className="font-medium text-gray-900 dark:text-white">AUTO</span>
              <span className="text-gray-700 dark:text-gray-200"> 🪄</span>
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
                <span className="text-gray-700 dark:text-gray-200">{providerName} /</span>
                <span className="font-medium text-gray-900 dark:text-white">{activeModel.label}</span>
                {modelMapping[activeModel.label || ''] && (
                  <span className="text-gray-500 dark:text-gray-300">
                    ‣{modelMapping[activeModel.label || '']}
                  </span>
                )}
              </div>
            </div>
          )}
          <Button 
            size="small" 
            appearance="subtle"
            style={{ 
              marginLeft: '4px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              borderRadius: '4px',
              height: '20px',
              minWidth: 'auto'
            }}
            className="hover:bg-blue-100 dark:hover:bg-blue-900/30 dark:bg-blue-900/40 dark:text-white"
          >
            Learn
          </Button>
          {activeModel.description && (
            <Tooltip
              content={activeModel.description as string}
              relationship="label"
            >
              <Button
                icon={<Info16Regular />}
                size="small"
                appearance="subtle"
                className="dark:text-white"
              />
            </Tooltip>
          )}
        </Button>
      </MenuTrigger>
      <MenuPopover className="model-menu-popup">
        <MenuList 
          style={{ 
            width: '450px', 
            ['--text-color' as any]: "white" 
          }} 
          className="dark:text-white force-white-text"
        >
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
                    <RouterStatusIndicator
                      provider={providerName}
                      model={autoModel?.name || ''}
                      withTooltip={true}
                    />
                    <span style={{ fontSize: '1rem', fontWeight: 500, textAlign: 'center', color: 'var(--text-color, inherit)' }} className="dark:text-white" data-dark-mode-text="true">&nbsp;&nbsp;✨ AUTO ✨</span>
                  </div>
                </div>
                <div style={{ paddingLeft: '4px' }}>
                  <span style={{ 
                    fontSize: '0.95rem', 
                    fontWeight: 500, 
                    color: 'var(--text-color, #1f2937)',
                  }} 
                  className="text-gray-800 dark:text-white"
                  data-dark-mode-text="true">Automatically selects the best advanced AI model for your task</span>
                </div>
                <div style={{ paddingLeft: '4px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ 
                    fontSize: '0.95rem', 
                    fontWeight: 700, 
                    color: 'var(--text-color, #1f2937)',
                    border: '1px solid #9ca3af',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    display: 'inline-block',
                    width: 'fit-content',
                    background: 'rgba(255,255,255,0.05)'
                  }} 
                  className="dark:text-white dark:border-gray-400 dark:bg-gray-700"
                  data-dark-mode-text="true">
                    Optimized for:
                  </span>
                  <div className="dark:bg-gray-800 bg-gray-100" style={{ display: 'flex', gap: '12px', marginLeft: '4px', padding: '6px 10px', borderRadius: '6px', width: 'fit-content' }}>
                    <span style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: 500 }} className="dark:text-blue-300">Performance</span>
                    <span style={{ color: '#9ca3af' }} className="dark:text-gray-400">•</span>
                    <span style={{ fontSize: '0.9rem', color: '#0891b2', fontWeight: 500 }} className="dark:text-cyan-300">Speed</span>
                    <span style={{ color: '#9ca3af' }} className="dark:text-gray-400">•</span>
                    <span style={{ fontSize: '0.9rem', color: '#059669', fontWeight: 500 }} className="dark:text-green-300">Cost</span>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
              <div className="px-1 text-sm text-gray-700 dark:text-gray-200">
                <p className="text-gray-800 dark:text-white font-bold text-base mb-3" style={{ color: 'var(--text-color, #1f2937)' }} data-dark-mode-text="true">Use the specialized model buttons for specific tasks:</p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-start p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-purple-500 dark:text-purple-300 text-lg mr-2">🔍</span>
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white" data-dark-mode-text="true">DeepSearch</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">For internet research & factual inquiries</div>
                    </div>
                  </div>
                  <div className="flex items-start p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-rose-500 dark:text-rose-300 text-lg mr-2">💭</span>
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white" data-dark-mode-text="true">DeepThought</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">For complex reasoning & analysis</div>
                    </div>
                  </div>
                  <div className="flex items-start p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-orange-500 dark:text-orange-300 text-lg mr-2">⚡</span>
                    <div>
                      <div className="font-medium text-gray-800 dark:text-white" data-dark-mode-text="true">Flash</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">For speed and processing long documents</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Additional divider line before secure hosting section */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-3"></div>
              
              {/* Secure Hosting Section */}
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-md border border-green-200 dark:border-green-500">
                <div className="flex items-center">
                  <div className="text-green-600 dark:text-green-300 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium">Secure US hosting with no-train policy</p>
                </div>
              </div>
            </div>
          )}
        </MenuList>
      </MenuPopover>
    </Menu>
  ) : (
    <Text size={200} className="text-gray-900 dark:text-white">
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
            <RouterStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
          </div>
          <span className="text-gray-700 dark:text-gray-200">OMNI /</span>
          <span className="font-medium text-gray-900 dark:text-white">AUTO</span>
          <span className="text-gray-700 dark:text-gray-200"> 🪄</span>
          <Button 
            size="small" 
            appearance="subtle"
            style={{ 
              marginLeft: '4px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              borderRadius: '4px',
              height: '20px',
              minWidth: 'auto'
            }}
            className="hover:bg-blue-100 dark:hover:bg-blue-900/30 dark:bg-blue-900/40 dark:text-white"
          >
            Learn
          </Button>
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
          <span className="text-gray-700 dark:text-gray-200">{providerName} /</span>
          <span className="font-medium text-gray-900 dark:text-white">{activeModel.label}</span>
          {modelMapping[activeModel.label || ''] && (
            <span className="text-gray-500 dark:text-gray-300">
              ‣{modelMapping[activeModel.label || '']}
            </span>
          )}
          <Button 
            size="small" 
            appearance="subtle"
            style={{ 
              marginLeft: '4px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              borderRadius: '4px',
              height: '20px',
              minWidth: 'auto'
            }}
            className="hover:bg-blue-100 dark:hover:bg-blue-900/30 dark:bg-blue-900/40 dark:text-white"
          >
            Learn
          </Button>
        </span>
      )}
    </Text>
  );
}




