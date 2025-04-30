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
import { Info16Regular, ChevronUp16Regular, Dismiss16Regular } from '@fluentui/react-icons';
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
          (specializedModel === 'Deep-Searcher-Pro' && (m.label === 'Sonar Reasoning' || m.name === 'perplexity/sonar-reasoning-pro')) ||
          (specializedModel === 'Deep-Thinker-R1' && (m.label === 'R1-1776' || m.name === 'perplexity/r1-1776')) ||
          (specializedModel === 'Flash 2.5' && (m.label === 'Flash 2.5' || m.name === 'google/gemini-2.5-flash-preview:thinking'))
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
    
    // Get current input value to preserve it
    const currentInput = useChatStore.getState().chat.input || '';
    
    const $model = data.checkedItems[0];
    editStage(chat.id, { 
      model: $model,
      // Preserve the current input text
      input: currentInput 
    });
    
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
        Mousetrap.bind('ctrl+shift+1', toggleDialog);
      } catch (error) {
        console.error('Error binding mousetrap:', error);
      }
    }
    return () => {
      try {
        Mousetrap.unbind('ctrl+shift+1');
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
          const shouldCollapse = availableWidth < 1100;
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

  return (
    <ClickAwayListener onClickAway={handleClickAway} active={open}>
      <Menu
        hasCheckmarks
        open={open}
        onCheckedValueChange={onModelChange}
        checkedValues={{ model: [activeModel.label as string] }}
      >
        <MenuTrigger disableButtonEnhancement>
          <Tooltip
            content={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Model')}</div>
                <div>Select an AI model for different capabilities (Ctrl+Shift+1)</div>
                <div style={{ marginTop: '3px', fontSize: '12px' }}>
                  Current: {providerName === 'Ollama' ? 'OMNI Edge' : providerName} / {
                    specializedModel === 'Deep-Searcher-Pro' ? 'DeepSearch-Pro' : 
                    specializedModel === 'Deep-Thinker-R1' ? 'DeepThought-R1' : 
                    specializedModel === 'Flash 2.5' ? 'Flash 2.5' : 
                    activeModel.label
                  }
                </div>
                {activeModel.contextWindow && (
                  <div style={{ marginTop: '3px', fontSize: '12px' }}>
                    Context: {Math.round(activeModel.contextWindow/1000)}K tokens
                  </div>
                )}
              </div>
            }
            relationship="description"
            positioning="above"
          >
          <Button
            aria-label={t('Common.Model')}
            size="small"
            appearance="subtle"
            onClick={toggleDialog}
            style={{
              // Use blue border highlight when Agent02 is active
              borderColor: (!specializedModel && autoEnabled) 
                ? (theme === 'dark' ? 'rgba(96, 165, 250, 0.6)' : 'rgba(59, 130, 246, 0.7)') // Blue border color
                : 'transparent',
              borderWidth: '0.5px', // Make border thinner (was 1px)
              borderStyle: 'solid', 
              boxShadow: 'none', // Remove box-shadow highlight
              padding: '4px 8px',
              borderRadius: '6px',
              backgroundColor: 'transparent', // Ensure background is transparent
              transition: 'border-color 0.2s ease',
              // Required for glint
              position: 'relative', 
              overflow: 'hidden'
            }}
            // Apply glint class conditionally
            className={`text-gray-900 dark:text-white flex justify-start items-center model-menu-trigger ${
              (!specializedModel && autoEnabled) ? 'agent-glint-active' : ''
            }`}
          >
            {/* OMNI Agent View (Selected by default or when autoEnabled is true and no specialized model) */}
            {(autoEnabled && autoModel && !specializedModel) ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {isCollapsed ? (
                  <Popover open={iconPopupOpen} onOpenChange={(e, data) => setIconPopupOpen(data.open)}>
                    <PopoverTrigger>
                      <div
                        role="button"
                        tabIndex={0}
                        className="p-1 mr-1 popup-trigger cursor-pointer"
                        onClick={toggleIconPopup}
                        onKeyDown={(e) => e.key === 'Enter' && toggleIconPopup(e as any)}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ChevronUp16Regular />
                      </div>
                    </PopoverTrigger>
                    <PopoverSurface>
                      <div className="popup-title">OMNI Attributes</div>
                      <div className="icon-popup-container">
                        <SecureStatusIndicator provider={providerName} withTooltip={true} />
                        <SearchStatusIndicator provider={providerName} model={activeModel.name} withTooltip={true} />
                        <ReasoningStatusIndicator provider={providerName} model={activeModel.name} withTooltip={true} />
                        <FastResponseStatusIndicator provider={providerName} model={activeModel.name} withTooltip={true} />
                        <ToolStatusIndicator provider={providerName} model={activeModel.name} withTooltip={true} />
                        <AgenticStatusIndicator provider={providerName} model={activeModel.name} withTooltip={true} />
                        <UncensoredStatusIndicator provider={providerName} model={activeModel.name} withTooltip={true} />
                        <MuricaStatusIndicator provider={providerName} model={activeModel.name} withTooltip={true} />
                        <ArjunsFavoriteStatusIndicator provider={providerName} model={activeModel.name} withTooltip={true} />
                        <LongContextStatusIndicator model={activeModel.name} provider={providerName} withTooltip={true} />
                      </div>
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
                <span 
                  className={`ml-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'} font-semibold`}
                  style={{ fontWeight: 600 }}
                >
                  {activeModel.label}
                </span>
                <div className={`learn-button ${theme === 'dark' ? 'dark-theme' : ''}`}>
                  Learn
                </div>
              </div>
            ) : (
              /* Specialized Model View (or fallback if auto is disabled/unavailable) */
              <div className="flex items-center">
                {/* Icons - Show collapsed version always? Or based on activeModel? */}
                {/* Let's show collapsed icons for specialized models too for consistency */} 
                 <div className="flex flex-row justify-start items-center mr-1">
                   {isCollapsed ? (
                     <Popover open={iconPopupOpen} onOpenChange={(e, data) => setIconPopupOpen(data.open)}>
                       {/* ... Popover Trigger ... */}
                       <PopoverSurface>
                          {/* ... Popover Content ... */}
                       </PopoverSurface>
                     </Popover>
                   ) : (
                     <AttributeIcons /> // Show full icons if not collapsed
                   )}
                 </div>
                {/* Model Name Section */}
                <div className="flex-shrink overflow-hidden whitespace-nowrap text-ellipsis min-w-12">
                  {/* Provider Name */}
                  <span className={theme === 'dark' ? 'text-white' : 'text-gray-800'}>
                    {providerName === 'Ollama' ? 'OMNI Edge' : providerName} /
                  </span>
                  {/* Specialized/Active Model Label */}
                  <span className={theme === 'dark' ? 'text-white font-medium' : 'text-gray-900 font-medium'}>
                    {/* Always display the label from the truly active model */}
                    {activeModel.label}
                  </span>
                  {/* Mapping (if exists) */}
                  {modelMapping[activeModel.label || ''] && (
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}>
                      ‣{modelMapping[activeModel.label || '']}
                    </span>
                  )}
                </div>
                {/* Learn Button */}
                <div className={`learn-button ${theme === 'dark' ? 'dark-theme' : ''}`}>
                  Learn
                </div>
              </div>
            )}
            {/* Info Icon Tooltip (always uses activeModel) */}
            {activeModel.description && (
              <Tooltip content={activeModel.description as string} relationship="label">
                 {/* ... Info Icon ... */}
              </Tooltip>
            )}
          </Button>
          </Tooltip>
        </MenuTrigger>
        <MenuPopover className={`model-menu-popup ${theme === 'dark' ? 'dark-theme' : ''}`}>
          {/* Close button */}
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1001 }}>
            <Button 
              appearance="subtle" 
              size="small" 
              icon={<Dismiss16Regular />} 
              aria-label="Close Menu" 
              onClick={closeDialog} 
            />
          </div>
          <MenuList 
            style={{ 
              width: '380px', 
              ['--text-color' as any]: theme === 'dark' ? 'white' : 'inherit',
              padding: '16px 0px 8px',
            }} 
            className={theme === 'dark' ? 'text-white' : ''}
          >
            <div className="px-4 pt-1 pb-3 text-xl font-semibold flex items-center" style={{ color: textColors.primary }}>
              <div className="model-title-glow mr-2"></div>
              {providerName === 'OMNI' ? 'OMNI AI' : providerName === 'Ollama' ? 'OMNI Edge' : providerName}
            </div>
            
            {autoModel && (
              <div className="px-4 py-2">
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                    <SecureStatusIndicator provider={providerName} withTooltip={true} />
                    <SearchStatusIndicator provider={providerName} model={autoModel?.name || ''} withTooltip={true} />
                    <ReasoningStatusIndicator provider={providerName} model={autoModel?.name || ''} withTooltip={true} />
                    <ToolStatusIndicator provider={providerName} model={autoModel?.name || ''} withTooltip={true} />
                    <AgenticStatusIndicator provider={providerName} model={autoModel?.name || ''} withTooltip={true} />
                    <span style={{ fontSize: '1rem', fontWeight: 600 }} className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                      &nbsp;Agent02
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: textColors.primary }} className="mb-1">
                      dddw2a with tool use, reasoning traces, and vision capabilities
                    </div>
                  </div>
                  
                  <div className={`capabilities-card ${theme === 'dark' ? 'dark-theme' : ''}`}>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="capability-tag tool-use">Tool Use</span>
                      <span className="text-gray-400 dark:text-gray-400">•</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="capability-tag reasoning">Reasoning</span>
                      <span className="text-gray-400 dark:text-gray-400">•</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }} className="capability-tag agentic">Agentic</span>
                    </div>
                  </div>
                </div>
                
                {providerName !== 'Ollama' && (
                  <div className="section-divider">
                    <p className="font-bold text-sm mb-3 px-1" style={{ color: textColors.primary }}>
                      Specialized models:
                    </p>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div className={`model-card deepsearch-card no-hover ${theme === 'dark' ? 'dark-theme' : ''}`}>
                        <span className="model-icon">🔍</span>
                        <div>
                          <div className="model-name">DeepSearch</div>
                          <div className="model-description">For internet research & factual inquiries</div>
                        </div>
                      </div>
                      
                      <div className={`model-card deepthought-card no-hover ${theme === 'dark' ? 'dark-theme' : ''}`}>
                        <span className="model-icon">💭</span>
                        <div>
                          <div className="model-name">DeepThought</div>
                          <div className="model-description">For complex reasoning & analysis</div>
                        </div>
                      </div>
                      
                      <div className={`model-card flash-card no-hover ${theme === 'dark' ? 'dark-theme' : ''}`}>
                        <span className="model-icon">⚡</span>
                        <div>
                          <div className="model-name">Flash</div>
                          <div className="model-description">For speed and processing long documents</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </MenuList>
        </MenuPopover>
      </Menu>
      
      <style>
        {`
          .icon-popup-container {
            padding: 10px;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            max-width: 260px;
          }
          
          .popup-title {
            font-weight: 600;
            font-size: 14px;
            color: var(--colorNeutralForeground1);
            padding: 10px 10px 6px;
            border-bottom: 1px solid rgba(var(--color-border), 0.15);
            margin-bottom: 10px;
            text-align: center;
            letter-spacing: 0.02em;
          }
          
          .model-menu-popup {
            border-radius: 14px;
            border: 1px solid rgba(var(--color-bg-surface-2), 0.5);
            box-shadow: 
              0 10px 25px -5px rgba(0, 0, 0, 0.2),
              0 8px 10px -6px rgba(0, 0, 0, 0.1),
              0 0 0 1px rgba(var(--color-bg-surface-2), 0.1);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 1000;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
            max-height: 85vh;
            overflow-y: auto;
            width: 380px !important;
            position: absolute !important;
            left: 20% !important;
            transform: none !important;
            top: 100% !important;
            margin-top: 10px !important;
            right: auto !important;
            max-width: 90vw;
            color: inherit;
          }
          
          /* Dark theme specific styles */
          .model-menu-popup.dark-theme {
            background-color: #1f2937 !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
            color: white !important;
          }
          
          .model-menu-popup.dark-theme .fui-MenuList {
            background-color: transparent !important;
            color: white !important;
          }
          
          .model-menu-popup.dark-theme .fui-MenuItem {
            color: white !important;
          }
          
          .model-card {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.2s ease;
            background-color: #f5f7f9;
            border: 1px solid rgba(0, 0, 0, 0.05);
          }
          
          .model-card.dark-theme {
            background-color: #2d3748 !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          
          .model-card .model-name {
            font-weight: 600;
            font-size: 0.95rem;
            color: #333;
          }
          
          .model-card.dark-theme .model-name {
            color: white !important;
          }
          
          .model-card .model-description {
            font-size: 0.85rem;
            color: #4b5563;
            margin-top: 2px;
          }
          
          .model-card.dark-theme .model-description {
            color: #d1d5db !important;
          }
          
          .capability-tag {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 500;
            display: inline-block;
          }
          
          .capability-tag.tool-use {
            background-color: rgba(16, 185, 129, 0.1);
            color: rgb(5, 150, 105);
          }
          
          .capability-tag.reasoning {
            background-color: rgba(139, 92, 246, 0.1);
            color: rgb(124, 58, 237);
          }
          
          .capability-tag.agentic {
            background-color: rgba(59, 130, 246, 0.1);
            color: rgb(37, 99, 235);
          }
          
          .dark-theme .capability-tag.tool-use {
            background-color: rgba(16, 185, 129, 0.2);
            color: rgb(52, 211, 153);
          }
          
          .dark-theme .capability-tag.reasoning {
            background-color: rgba(139, 92, 246, 0.2);
            color: rgb(167, 139, 250);
          }
          
          .dark-theme .capability-tag.agentic {
            background-color: rgba(59, 130, 246, 0.2);
            color: rgb(96, 165, 250);
          }
          
          .capabilities-card {
            background-color: #f5f7f9;
            border-radius: 8px;
            padding: 8px 12px;
            border: 1px solid rgba(0, 0, 0, 0.05);
          }
          
          .capabilities-card.dark-theme {
            background-color: #2d3748 !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          
          .deepsearch-card {
            background-color: rgba(59, 130, 246, 0.05);
            border-color: rgba(59, 130, 246, 0.2);
          }
          
          .deepsearch-card.dark-theme {
            background-color: rgba(59, 130, 246, 0.1) !important;
            border-color: rgba(59, 130, 246, 0.3) !important;
          }
          
          .deepthought-card {
            background-color: rgba(139, 92, 246, 0.05);
            border-color: rgba(139, 92, 246, 0.2);
          }
          
          .deepthought-card.dark-theme {
            background-color: rgba(139, 92, 246, 0.1) !important;
            border-color: rgba(139, 92, 246, 0.3) !important;
          }
          
          .flash-card {
            background-color: rgba(249, 115, 22, 0.05);
            border-color: rgba(249, 115, 22, 0.2);
          }
          
          .flash-card.dark-theme {
            background-color: rgba(249, 115, 22, 0.1) !important;
            border-color: rgba(249, 115, 22, 0.3) !important;
          }
          
          .learn-button {
            background-color: #f3f4f6;
            color: #4b5563;
            font-size: 0.75rem;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 4px;
            margin-left: 12px;
            border: 1px solid #e5e7eb;
          }
          
          .learn-button.dark-theme {
            background-color: #374151;
            color: #d1d5db;
            border-color: #4b5563;
          }
          
          .model-title-glow {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: linear-gradient(135deg, #0ea5e9, #8b5cf6);
            box-shadow: 0 0 12px rgba(14, 165, 233, 0.4);
          }

          /* Glint Animation */
          @keyframes glint {
            0% { transform: translateX(-100%) skewX(-20deg); opacity: 0.5; }
            5% { opacity: 0.8; }
            10% { transform: translateX(100%) skewX(-20deg); opacity: 0; }
            100% { transform: translateX(100%) skewX(-20deg); opacity: 0; }
          }

          .agent-glint-active {
            position: relative; /* Needed for pseudo-element positioning */
            overflow: hidden;   /* Hide pseudo-element outside bounds */
          }

          .agent-glint-active::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 40%; 
            height: 100%;
            background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 255, 255, 0) 100%);
            opacity: 0;
            transform: translateX(-100%) skewX(-20deg);
            /* Slower animation, long delay */
            animation: glint 6s ease-in-out 5s infinite; /* Increase duration */
            z-index: 1; 
          }
        `}
      </style>
    </ClickAwayListener>
  );
}




