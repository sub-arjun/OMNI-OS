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
import useAppearanceStore from 'stores/useAppearanceStore';
import { IChatModel, ProviderType, ChatModelGroup } from 'providers/types';
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
  
  // Add null checks and default values for store selectors
  const api = useSettingsStore((state) => state?.api || { provider: 'OMNI' });
  const modelMapping = useSettingsStore((state) => state?.modelMapping || {});
  const getToolState = useSettingsStore((state) => state?.getToolState);
  const setToolState = useSettingsStore((state) => state?.setToolState);
  const autoEnabled = useSettingsStore((state) => state?.autoEnabled ?? true);
  const setAutoEnabled = useSettingsStore((state) => state?.setAutoEnabled);
  const session = useAuthStore((state) => state?.session);
  const editStage = useChatStore((state) => state?.editStage);
  // Get theme from appearance store with a default value
  const theme = useAppearanceStore((state) => state?.theme || 'light');
  
  const { getProvider, getChatModels } = useProvider();
  // Don't use state value directly from store in useState initial value
  // This is to prevent re-renders when api.provider changes
  const [providerName, setProviderName] = useState<ProviderType>('OMNI');
  
  // Set provider name once on mount or when api.provider changes
  useEffect(() => {
    if (api?.provider) {
      setProviderName(api.provider);
    }
  }, [api?.provider]);
  
  // Define text colors based on theme
  const textColors = useMemo(() => {
    return {
      primary: theme === 'dark' ? 'white' : '#1f2937',
      secondary: theme === 'dark' ? '#e5e7eb' : '#4b5563',
    };
  }, [theme]);

  const allModels = useMemo<IChatModel[]>(() => {
    if (!api?.provider || api.provider === 'Azure') return [];
    try {
      const provider = getProvider?.(api.provider);
      if (!provider) return [];
      
      // Move state update to useEffect to avoid render loop
      // Don't update state during render/useMemo
      return provider.chat?.options?.modelCustomizable && getChatModels?.(provider.name) || [];
    } catch (error) {
      console.error('Error loading models:', error);
    }
    return [];
  }, [api?.provider, session, getProvider, getChatModels]);

  // Update provider name in useEffect instead of during render
  useEffect(() => {
    if (api?.provider && getProvider) {
      try {
        const provider = getProvider(api.provider);
        if (provider?.name) {
          setProviderName(provider.name);
        }
      } catch (error) {
        console.error('Error setting provider name:', error);
      }
    }
  }, [api?.provider, getProvider]);

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
  }, [autoModel]);

  const activeModel = useMemo(() => {
    try {
      return ctx?.getModel() || { 
        label: 'Default', 
        name: 'default', 
        autoEnabled: false, 
        description: '',
        contextWindow: null,
        inputPrice: 0,
        outputPrice: 0,
        group: 'OMNI' as ChatModelGroup
      };
    } catch (error) {
      console.error('Error getting model:', error);
      return { 
        label: 'Default', 
        name: 'default', 
        autoEnabled: false, 
        description: '',
        contextWindow: null,
        inputPrice: 0,
        outputPrice: 0,
        group: 'OMNI' as ChatModelGroup
      };
    }
  }, [ctx]);

  // Set autoEnabled to true by default
  useEffect(() => {
    if (autoEnabled === false && autoModel && setAutoEnabled) {
      setAutoEnabled(true);
    }
  }, [autoEnabled, autoModel, setAutoEnabled]);

  const onModelChange = (
    _: MenuCheckedValueChangeEvent,
    data: MenuCheckedValueChangeData,
  ) => {
    if (!chat?.id || !editStage) return;
    
    const $model = data.checkedItems[0];
    editStage(chat.id, { model: $model });
    
    try {
      window.electron?.ingestEvent?.([{ app: 'switch-model' }, { model: $model }]);
    } catch (error) {
      console.error('Error ingesting event:', error);
    }
    
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
    try {
      Mousetrap.bind('esc', closeDialog);
    } catch (error) {
      console.error('Error binding mousetrap:', error);
    }
  };

  const closeDialog = () => {
    setOpen(false);
    try {
      Mousetrap.unbind('esc');
    } catch (error) {
      console.error('Error unbinding mousetrap:', error);
    }
  };

  useEffect(() => {
    if (models.length > 0) {
      try {
        Mousetrap.bind('mod+shift+1', toggleDialog);
      } catch (error) {
        console.error('Error binding mousetrap:', error);
      }
    }
    return () => {
      try {
        Mousetrap.unbind('mod+shift+1');
      } catch (error) {
        console.error('Error unbinding mousetrap:', error);
      }
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
              <span className="text-gray-700 dark:text-gray-200">
                {providerName === 'Ollama' ? 'OMNI Edge' : providerName}
                {providerName !== 'Ollama' && ' /'}
              </span>
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
                <span className="text-gray-800 dark:text-white">
                  {providerName === 'Ollama' ? 'OMNI Edge' : providerName} /
                </span>
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
              fontSize: '10px',
              padding: '3px 10px',
              borderRadius: '4px',
              height: '20px',
              minWidth: 'auto',
              marginLeft: '6px'
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
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
                className="text-gray-700 dark:text-white"
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
          className="dark:text-white"
        >
          <div className="px-3 pt-2 text-xl font-semibold" style={{ color: textColors.primary }}>
            {providerName === 'OMNI' ? 'OMNI AI' : providerName === 'Ollama' ? 'OMNI Edge' : providerName}
          </div>
          
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
                    <span style={{ fontSize: '1rem', fontWeight: 500, textAlign: 'center' }} className="text-gray-800 dark:text-white">&nbsp;&nbsp;✨ AUTO ✨</span>
                  </div>
                  <GreenSwitch
                    checked={autoEnabled}
                    onChange={(ev, { checked }) => {
                      setAutoEnabled(checked);
                    }}
                  />
                </div>
                <div className="mb-2">
                  <div 
                    style={{ 
                      fontSize: '0.95rem', 
                      fontWeight: 600,
                      color: textColors.primary
                    }}
                  >
                    Automatically selects the best advanced AI model for your task
                  </div>
                  <div className="text-xs text-gray-500 dark:text-white">
                    <span className="opacity-80">Powered by {providerName === 'OMNI' ? 'OMNI OS' : providerName === 'Ollama' ? 'OMNI Edge' : providerName}</span>
                  </div>
                </div>
                <div style={{ paddingLeft: '4px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ 
                    fontSize: '0.95rem', 
                    fontWeight: 700,
                    border: '1px solid #9ca3af',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    display: 'inline-block',
                    width: 'fit-content',
                    background: 'rgba(255,255,255,0.05)',
                    color: textColors.primary
                  }}
                  className="dark:border-gray-400 dark:bg-gray-700"
                >
                  Optimized for:
                </span>
                  <div className="dark:bg-gray-800 bg-gray-100" style={{ display: 'flex', gap: '12px', marginLeft: '4px', padding: '6px 10px', borderRadius: '6px', width: 'fit-content' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="text-blue-600 dark:text-blue-300">Performance</span>
                    <span className="text-gray-400 dark:text-gray-400">•</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="text-cyan-600 dark:text-cyan-300">Speed</span>
                    <span className="text-gray-400 dark:text-gray-400">•</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="text-green-600 dark:text-green-300">Cost</span>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
              
              {/* Only show specialized model section for non-Ollama providers */}
              {providerName !== 'Ollama' && (
                <>
                  <div className="px-1 text-sm text-gray-700 dark:text-gray-200">
                    <p className="font-bold text-base mb-3" style={{ color: textColors.primary }}>
                      Use the specialized model buttons for specific tasks:
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-start p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <span className="text-purple-500 dark:text-purple-300 text-lg mr-2">🔍</span>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white">DeepSearch</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">For internet research & factual inquiries</div>
                        </div>
                      </div>
                      <div className="flex items-start p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <span className="text-rose-500 dark:text-rose-300 text-lg mr-2">💭</span>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white">DeepThought</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">For complex reasoning & analysis</div>
                        </div>
                      </div>
                      <div className="flex items-start p-2 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <span className="text-orange-500 dark:text-orange-300 text-lg mr-2">⚡</span>
                        <div>
                          <div className="font-medium text-gray-800 dark:text-white">Flash</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">For speed and processing long documents</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Additional divider line before secure hosting section */}
                  <div className="border-t border-gray-200 dark:border-gray-700 my-3"></div>
                </>
              )}
              
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
          <span className="text-gray-700 dark:text-gray-200">
            {providerName === 'Ollama' ? 'OMNI Edge' : providerName}
            {providerName !== 'Ollama' && ' /'}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">AUTO</span>
          <span className="text-gray-700 dark:text-gray-200"> 🪄</span>
          {providerName !== 'Ollama' && (
            <Button 
              size="small" 
              appearance="subtle"
              style={{
                fontSize: '10px',
                padding: '3px 10px',
                borderRadius: '4px',
                height: '20px',
                minWidth: 'auto',
                marginLeft: '6px'
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              Learn
            </Button>
          )}
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
          <span className="text-gray-800 dark:text-white">
            {providerName === 'Ollama' ? 'OMNI Edge' : providerName}
            {providerName !== 'Ollama' && ' /'}
          </span>
          {providerName !== 'Ollama' && (
            <span className="font-medium text-gray-900 dark:text-white">{activeModel.label}</span>
          )}
          {providerName !== 'Ollama' && modelMapping[activeModel.label || ''] && (
            <span className="text-gray-500 dark:text-gray-300">
              ‣{modelMapping[activeModel.label || '']}
            </span>
          )}
          {providerName !== 'Ollama' && (
            <Button 
              size="small" 
              appearance="subtle"
              style={{
                fontSize: '10px',
                padding: '3px 10px',
                borderRadius: '4px',
                height: '20px',
                minWidth: 'auto',
                marginLeft: '6px'
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              Learn
            </Button>
          )}
        </span>
      )}
    </Text>
  );
}




