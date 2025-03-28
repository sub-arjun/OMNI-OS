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
import { Info16Regular, ChevronUp16Regular } from '@fluentui/react-icons';
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
import AgenticStatusIndicator from 'renderer/components/AgenticStatusIndicator';
import SecureStatusIndicator from '../../../../components/SecureStatusIndicator';
import RouterStatusIndicator from '../../../../components/RouterStatusIndicator';
import { isUndefined } from 'lodash';
import ClickAwayListener from 'renderer/components/ClickAwayListener';

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
  const [open, setOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [iconPopupOpen, setIconPopupOpen] = useState<boolean>(false);
  const iconContainerRef = useRef<HTMLDivElement>(null);
  
  // Add null checks and default values for store selectors
  const api = useSettingsStore((state) => state?.api || { provider: 'OMNI' });
  const modelMapping = useSettingsStore((state) => state?.modelMapping || {});
  const getToolState = useSettingsStore((state) => state?.getToolState);
  const setToolState = useSettingsStore((state) => state?.setToolState);
  const autoEnabled = useSettingsStore((state) => state?.autoEnabled ?? true);
  const setAutoEnabled = useSettingsStore((state) => state?.setAutoEnabled);
  const specializedModel = useSettingsStore((state) => state?.specializedModel);
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
    return allModels.find(model => model.autoEnabled === true || model.agentEnabled === true);
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
      // Force re-evaluation when specializedModel changes
      if (specializedModel) {
        // Find the specialized model in allModels
        const model = allModels.find(m => 
          (specializedModel === 'Deep-Searcher-R1' && (m.label === 'Sonar Reasoning' || m.name === 'perplexity/sonar-reasoning-pro')) ||
          (specializedModel === 'Deep-Thinker-R1' && (m.label === 'R1-1776' || m.name === 'perplexity/r1-1776')) ||
          (specializedModel === 'Flash-2.0' && (m.label === 'Flash-2.0' || m.name === 'google/gemini-2.0-flash-001'))
        );
        
        if (model) {
          return model;
        }
      }
      
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
  }, [ctx, specializedModel, allModels]);

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

  // Handle click away from the model menu
  const handleClickAway = () => {
    if (open) {
      closeDialog();
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

  // Check if we need to collapse the icons based on window size
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let timeoutId: NodeJS.Timeout;
    let debounceTimeout: NodeJS.Timeout;
    let checkCount = 0;
    let previousWidth = 0;
    
    // Add debounce to prevent rapid firing
    const debouncedCheckSpace = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(checkSpace, 200);
    };
    
    const checkSpace = () => {
      // Limit to maximum of 5 checks per mount to prevent infinite loops
      if (checkCount >= 5) {
        console.log('ModelCtrl: Max resize checks reached, stopping resize checks');
        return;
      }
      
      checkCount++;
      
      try {
        // Get the toolbar element width regardless of iconContainerRef
        const toolbar = document.querySelector('.editor-toolbar');
        const availableWidth = toolbar?.clientWidth || window.innerWidth;
        
        // Only update if width changed significantly (by more than 10px)
        // This prevents micro-adjustments causing re-renders
        if (Math.abs(availableWidth - previousWidth) > 10) {
          previousWidth = availableWidth;
          
          // Set collapsed state based on available width
          const shouldCollapse = availableWidth < 900;
          console.log(`ModelCtrl: Width ${availableWidth}px - should${shouldCollapse ? '' : ' not'} collapse`);
          
          // Only update state if it actually changed
          setIsCollapsed(prevState => {
            if (prevState !== shouldCollapse) {
              return shouldCollapse;
            }
            return prevState;
          });
        }
      } catch (error) {
        console.error('ModelCtrl: Error checking space:', error);
      }
    };

    // Setup ResizeObserver with error handling
    const setupResizeObserver = () => {
      try {
        // Clear any existing observer
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        
        // Create new observer with debounced handler
        resizeObserver = new ResizeObserver(debouncedCheckSpace);
        
        // Get toolbar and observe it
        const toolbar = document.querySelector('.editor-toolbar');
        if (toolbar) {
          resizeObserver.observe(toolbar);
          console.log('ModelCtrl: Observing toolbar for resize');
        } else {
          console.log('ModelCtrl: Toolbar not found, will retry');
          timeoutId = setTimeout(setupResizeObserver, 100);
        }
      } catch (error) {
        console.error('ModelCtrl: Error setting up resize observer:', error);
      }
    };

    // Force initial state and perform checks
    try {
      // Initial check and observer setup - but don't force state to prevent flicker
      checkSpace();
      setupResizeObserver();
      
      // Also listen for window resize events with debounce
      window.addEventListener('resize', debouncedCheckSpace);
      
      // Run additional check after a delay
      setTimeout(checkSpace, 500);
    } catch (error) {
      console.error('ModelCtrl: Error during initial setup:', error);
    }
    
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(debounceTimeout);
      
      if (resizeObserver) {
        try {
          resizeObserver.disconnect();
        } catch (error) {
          console.error('ModelCtrl: Error disconnecting observer:', error);
        }
      }
      
      window.removeEventListener('resize', debouncedCheckSpace);
    };
  }, []); // Run only on mount

  // Toggle the icon popup
  const toggleIconPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIconPopupOpen(!iconPopupOpen);
  };

  // Close the popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if clicked within the popup or the trigger button
      const popupEl = document.querySelector('.fui-PopoverSurface');
      const triggerButton = document.querySelector('.popup-trigger');
      
      if (iconPopupOpen && 
          popupEl && 
          !popupEl.contains(e.target as Node) && 
          triggerButton && 
          !triggerButton.contains(e.target as Node)) {
        setIconPopupOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [iconPopupOpen]);

  // Attribute icons component for reuse
  const AttributeIcons = ({ collapsed = false, inPopup = false }) => (
    <div 
      ref={inPopup ? null : iconContainerRef} 
      className={`flex justify-start items-center ${inPopup ? 'icon-popup-container' : ''}`}
      style={{ 
        flexDirection: inPopup ? 'row' : 'row',
        flexWrap: inPopup ? 'wrap' : 'nowrap',
        gap: inPopup ? '5px' : '0',
        padding: inPopup ? '8px' : '0',
        maxWidth: inPopup ? 'none' : undefined,
        width: inPopup ? 'auto' : undefined
      }}
    >
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
      <AgenticStatusIndicator
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
  );

  return models && models.length ? (
    <ClickAwayListener onClickAway={handleClickAway} active={open}>
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
                {isCollapsed ? (
                  <Popover
                    open={iconPopupOpen}
                    onOpenChange={(e, data) => setIconPopupOpen(data.open)}
                  >
                    <PopoverTrigger>
                      <Button
                        size="small"
                        appearance="subtle"
                        className="p-1 mr-1 popup-trigger"
                        icon={<ChevronUp16Regular />}
                        onClick={toggleIconPopup}
                      />
                    </PopoverTrigger>
                    <PopoverSurface>
                      <div className="popup-title">OMNI Attributes</div>
                      <AttributeIcons inPopup={true} />
                    </PopoverSurface>
                  </Popover>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <AttributeIcons />
                  </div>
                )}
                <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}>
                  {providerName === 'Ollama' ? 'OMNI Edge' : providerName}
                  {providerName !== 'Ollama' && ' /'}
                </span>
                <span className={theme === 'dark' ? 'text-white font-medium' : 'text-gray-900 font-medium'}>OMNI Agent</span>
                <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}> ✨</span>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="flex flex-row justify-start items-center mr-1">
                  {isCollapsed ? (
                    <Popover
                      open={iconPopupOpen}
                      onOpenChange={(e, data) => setIconPopupOpen(data.open)}
                    >
                      <PopoverTrigger>
                        <Button
                          size="small"
                          appearance="subtle"
                          className="p-1 mr-1 popup-trigger"
                          icon={<ChevronUp16Regular />}
                          onClick={toggleIconPopup}
                        />
                      </PopoverTrigger>
                      <PopoverSurface>
                        <div className="popup-title">OMNI Attributes</div>
                        <AttributeIcons inPopup={true} />
                      </PopoverSurface>
                    </Popover>
                  ) : (
                    <AttributeIcons />
                  )}
                </div>
                <div className="flex-shrink overflow-hidden whitespace-nowrap text-ellipsis min-w-12">
                  <span className={theme === 'dark' ? 'text-white' : 'text-gray-800'}>
                    {providerName === 'Ollama' ? 'OMNI Edge' : providerName} /
                  </span>
                  <span className={theme === 'dark' ? 'text-white font-medium' : 'text-gray-900 font-medium'}>
                    {specializedModel === 'Deep-Searcher-R1' ? 'DeepSearch-Pro' : 
                     specializedModel === 'Deep-Thinker-R1' ? 'DeepThought-R1' : 
                     specializedModel === 'Flash-2.0' ? 'Flash-2.0' : 
                     activeModel.label}
                  </span>
                  {modelMapping[activeModel.label || ''] && (
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}>
                      ‣{modelMapping[activeModel.label || '']}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div 
              className="hover:bg-blue-700 text-white"
              style={{
                fontSize: '10px',
                padding: '3px 10px',
                borderRadius: '4px',
                height: '20px',
                minWidth: 'auto',
                marginLeft: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                backgroundColor: 'rgba(59, 130, 246, 0.75)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Learn
            </div>
            {activeModel.description && (
              <Tooltip
                content={activeModel.description as string}
                relationship="label"
              >
                <Button
                  icon={<Info16Regular />}
                  size="small"
                  appearance="subtle"
                  className={theme === 'dark' ? 'text-white' : 'text-gray-700'}
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
            className={theme === 'dark' ? 'text-white' : ''}
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
                      <AgenticStatusIndicator
                        provider={providerName}
                        model={autoModel?.name || ''}
                        withTooltip={true}
                      />
                      <RouterStatusIndicator
                        provider={providerName}
                        model={autoModel?.name || ''}
                        withTooltip={true}
                      />
                      <span style={{ fontSize: '1rem', fontWeight: 500, textAlign: 'center' }} className="text-gray-800 dark:text-white">&nbsp;&nbsp;✨ OMNI Agent ✨</span>
                    </div>
                  </div>
                  <div className="mb-2">
                    <div 
                      style={{ 
                        fontSize: '0.95rem', 
                        fontWeight: 600,
                        color: textColors.primary
                      }}
                    >
                      Elite model with tool use, reasoning traces, and vision capabilities
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
                    Advanced capabilities:
                  </span>
                    <div className="dark:bg-gray-800 bg-gray-100" style={{ display: 'flex', gap: '12px', marginLeft: '4px', padding: '6px 10px', borderRadius: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="text-blue-600 dark:text-blue-300">Tool Use</span>
                      <span className="text-gray-400 dark:text-gray-400">•</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="text-purple-600 dark:text-purple-300">Reasoning</span>
                      <span className="text-gray-400 dark:text-gray-400">•</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="text-violet-600 dark:text-violet-300">Agentic</span>
                      <span className="text-gray-400 dark:text-gray-400">•</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="text-green-600 dark:text-green-300">Adaptivity</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-500">
                      <p className="font-medium text-blue-700 dark:text-blue-300">Designed for complex tasks and applications</p>
                      <p className="mt-1">OMNI Agent dynamically decides whether to think and how much to think based on the complexity of your task.</p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
                
                {/* Only show specialized model section for non-Ollama providers */}
                {providerName !== 'Ollama' && (
                  <>
                    <div className="px-1 text-sm text-gray-700 dark:text-gray-200">
                      <p className="font-bold text-base mb-3" style={{ color: textColors.primary }}>
                        Choose specialized models:
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
      
      <style>
        {`
          .icon-popup-container {
            padding: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            max-width: 250px;
          }
          
          .popup-title {
            font-weight: 600;
            font-size: 14px;
            color: var(--colorNeutralForeground1);
            padding: 8px 8px 4px 8px;
            border-bottom: 1px solid var(--colorNeutralStroke1);
            margin-bottom: 8px;
            text-align: center;
          }
          
          @media (max-width: 700px) {
            .model-selector-text {
              max-width: 150px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        `}
      </style>
    </ClickAwayListener>
  ) : (
    <Text size={200} className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      {autoEnabled && autoModel && activeModel.autoEnabled ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <AttributeIcons />
          </div>
          <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}>
            {providerName === 'Ollama' ? 'OMNI Edge' : providerName}
            {providerName !== 'Ollama' && ' /'}
          </span>
          <span className={theme === 'dark' ? 'text-white font-medium' : 'text-gray-900 font-medium'}>OMNI Agent</span>
          <span className={theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}> ✨</span>
          {providerName !== 'Ollama' && (
            <div 
              className="hover:bg-blue-700 text-white"
              style={{
                fontSize: '10px',
                padding: '3px 10px',
                borderRadius: '4px',
                height: '20px',
                minWidth: 'auto',
                marginLeft: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                backgroundColor: 'rgba(59, 130, 246, 0.75)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Learn
            </div>
          )}
        </div>
      ) : (
        <span className="flex justify-start items-center gap-1">
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <AttributeIcons />
          </div>
          <span className={theme === 'dark' ? 'text-white' : 'text-gray-800'}>
            {providerName === 'Ollama' ? 'OMNI Edge' : providerName}
            {providerName !== 'Ollama' && ' /'}
          </span>
          {providerName !== 'Ollama' && (
            <span className={theme === 'dark' ? 'text-white font-medium' : 'text-gray-900 font-medium'}>
              {specializedModel === 'Deep-Searcher-R1' ? 'DeepSearch' : 
               specializedModel === 'Deep-Thinker-R1' ? 'DeepThought' : 
               specializedModel === 'Flash-2.0' ? 'Flash' : 
               activeModel.label}
            </span>
          )}
          {providerName !== 'Ollama' && modelMapping[activeModel.label || ''] && (
            <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}>
              ‣{modelMapping[activeModel.label || '']}
            </span>
          )}
          {providerName !== 'Ollama' && (
            <div 
              className="hover:bg-blue-700 text-white"
              style={{
                fontSize: '10px',
                padding: '3px 10px',
                borderRadius: '4px',
                height: '20px',
                minWidth: 'auto',
                marginLeft: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                backgroundColor: 'rgba(59, 130, 246, 0.75)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Learn
            </div>
          )}
        </span>
      )}
    </Text>
  );
}




