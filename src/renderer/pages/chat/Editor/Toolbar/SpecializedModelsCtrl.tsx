import {
  Button,
  Menu,
  MenuList,
  MenuItem,
  MenuPopover,
  MenuTrigger,
  Tooltip,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import { 
  Search16Regular, 
  BrainCircuit20Regular, 
  Flash16Regular, 
  ChevronDown16Regular,
  DismissCircle16Regular,
  Globe16Regular
} from '@fluentui/react-icons';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IChat, IChatContext } from 'intellichat/types';
import useChatStore from 'stores/useChatStore';
import useProvider from 'hooks/useProvider';
import useSettingsStore from 'stores/useSettingsStore';
import useAppearanceStore from 'stores/useAppearanceStore';
import Mousetrap from 'mousetrap';

export default function SpecializedModelsCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  const { t } = useTranslation();
  const specializedModel = useSettingsStore((state) => state.specializedModel);
  const setSpecializedModel = useSettingsStore((state) => state.setSpecializedModel);
  const setAutoEnabled = useSettingsStore((state) => state.setAutoEnabled);
  const [messageCount, setMessageCount] = useState<number>(0);
  const editStage = useChatStore((state) => state.editStage);
  const messages = useChatStore((state) => state.messages);
  const { getProvider, getChatModels } = useProvider();
  const theme = useAppearanceStore((state) => state?.theme || 'light');
  
  // State for menu and responsive layout
  const [open, setOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Sync specialized model state with chat's model on chat load/switch ---
  useEffect(() => {
    if (!chat || !chat.model) return;

    // List of specialized model labels
    const specializedLabels = [
      'Deep-Searcher-Pro',
      'Deep-Thinker-R1',
      'Flash 2.5',
      'Sonar Reasoning',
      'R1-1776',
      'google/gemini-2.5-flash-preview:thinking',
      'perplexity/sonar-reasoning-pro',
      'perplexity/r1-1776'
    ];

    // If the current chat's model is a specialized model, ensure store reflects it
    if (specializedLabels.includes(chat.model)) {
      if (specializedModel !== chat.model) {
        setSpecializedModel(chat.model);
        setAutoEnabled(false);
      }
    } else {
      // Otherwise, ensure specializedModel is null and auto is enabled
      if (specializedModel !== null) {
        setSpecializedModel(null);
        setAutoEnabled(true);
      }
    }
    // Only run when chat changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, chat?.model]);

  // Store current settings
  const systemMessageRef = useRef<string | null | undefined>(null);
  const temperatureRef = useRef<number | undefined>(undefined);
  const maxTokensRef = useRef<number | null | undefined>(undefined);
  const maxCtxMessagesRef = useRef<number | undefined>(undefined);
  
  // Get models
  const provider = useMemo(() => getProvider('OMNI'), [getProvider]);
  const allModels = useMemo(() => getChatModels(provider.name) || [], [getChatModels, provider.name]);
  
  // Find the specialized models
  const deepSearcherModel = useMemo(() => 
    allModels.find(model => 
      model.label === 'Sonar Reasoning' || 
      model.name === 'perplexity/sonar-reasoning-pro' ||
      model.label === 'Deep-Searcher-Pro'
    ),
    [allModels]
  );
  
  const deepThoughtModel = useMemo(() => 
    allModels.find(model => model.label === 'R1-1776' || model.name === 'perplexity/r1-1776'),
    [allModels]
  );
  
  const flashModel = useMemo(() => 
    allModels.find(model => model.label === 'Flash 2.5' || model.name === 'google/gemini-2.5-flash-preview:thinking'),
    [allModels]
  );
  
  // Check if any specialized model is enabled
  const hasSpecializedModel = specializedModel !== null;
  
  // Check for available space and toggle collapsed state
  useEffect(() => {
    const checkSpace = () => {
      const toolbar = document.querySelector('.editor-toolbar');
      const availableWidth = toolbar?.clientWidth || window.innerWidth;
      
      // If width is below threshold, collapse specialized models
      // Increase threshold significantly to force collapse sooner
      setIsCollapsed(availableWidth < 900);
    };
    
    // Setup ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      checkSpace();
    });
    
    // Observe toolbar element
    const toolbar = document.querySelector('.editor-toolbar');
    if (toolbar) {
      resizeObserver.observe(toolbar);
    }
    
    // Also listen for window resize
    window.addEventListener('resize', checkSpace);
    
    // Initial check
    checkSpace();
    
    // Force a delayed check to ensure DOM is ready
    const timeoutId = setTimeout(checkSpace, 500);
    
    return () => {
      window.removeEventListener('resize', checkSpace);
      clearTimeout(timeoutId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);
  
  // Get icon based on selected model
  const getIcon = () => {
    switch(specializedModel) {
      case 'Deep-Searcher-Pro': return <Globe16Regular className="mr-1" style={{ color: '#0078d4' }} />;
      case 'Deep-Thinker-R1': return <BrainCircuit20Regular className="mr-1" style={{ color: '#8b5cf6' }} />;
      case 'Flash 2.5': return <Flash16Regular className="mr-1" style={{ color: '#f97316' }} />;
      default: return null;
    }
  };
  
  // Get display name based on selected model
  const getDisplayName = () => {
    switch(specializedModel) {
      case 'Deep-Searcher-Pro': return 'DeepSearch';
      case 'Deep-Thinker-R1': return 'DeepThought';
      case 'Flash 2.5': return 'Flash';
      default: return 'Specialized';
    }
  };
  
  // Get button color based on selected model
  const getButtonColor = (modelType: string, isActive = true) => {
    if (!isActive) return 'px-2 py-0.5 text-sm';
    
    switch(modelType) {
      case 'Deep-Searcher-Pro': return `${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'} ${theme === 'dark' ? 'hover:bg-blue-700' : 'hover:bg-blue-600'} text-white px-2 py-0.5 text-sm`; // Blue
      case 'Deep-Thinker-R1': return `${theme === 'dark' ? 'bg-purple-600' : 'bg-purple-500'} ${theme === 'dark' ? 'hover:bg-purple-700' : 'hover:bg-purple-600'} text-white px-2 py-0.5 text-sm`; // Purple
      case 'Flash 2.5': return `${theme === 'dark' ? 'bg-orange-600' : 'bg-orange-500'} ${theme === 'dark' ? 'hover:bg-orange-700' : 'hover:bg-orange-600'} text-white px-2 py-0.5 text-sm`; // Orange
      default: return 'px-2 py-0.5 text-sm';
    }
  };
  
  // Save current settings
  const saveCurrentSettings = () => {
    systemMessageRef.current = ctx.getSystemMessage();
    temperatureRef.current = ctx.getTemperature();
    maxTokensRef.current = ctx.getMaxTokens();
    maxCtxMessagesRef.current = chat.maxCtxMessages;
  };
  
  // Switch model
  const switchToModel = (modelType: string | null, modelObj: any) => {
    // Get current input value to preserve it
    const currentInput = useChatStore.getState().chat.input || '';
    
    if (modelType) {
      // Enable specialized model
      setSpecializedModel(modelType);
      
      // Ensure AUTO is disabled
      setAutoEnabled(false);
      
      if (modelObj) {
        // Switch to specialized model
        editStage(chat.id, { 
          model: modelObj.label,
          // Keep the same settings
          systemMessage: systemMessageRef.current,
          temperature: temperatureRef.current,
          maxTokens: maxTokensRef.current,
          maxCtxMessages: maxCtxMessagesRef.current,
          // Preserve the current input text
          input: currentInput
        });
      }
    } else {
      // Disable specialized model
      setSpecializedModel(null);
      
      // Enable Agent02
      setAutoEnabled(true);
      
      // Get the Agent02 model
      const agentModel = allModels.find(model => model.autoEnabled === true || model.agentEnabled === true);
      
      // Switch back to Agent02 model
      if (agentModel) {
        editStage(chat.id, { 
          model: agentModel.label,
          // Keep the same settings
          systemMessage: systemMessageRef.current,
          temperature: temperatureRef.current,
          maxTokens: maxTokensRef.current,
          maxCtxMessages: maxCtxMessagesRef.current,
          // Preserve the current input text
          input: currentInput
        });
      }
    }
    
    // Close menu
    setOpen(false);
  };
  
  // Handle item selection
  const handleSelect = (modelType: string | null, modelObj: any) => {
    // If selecting the same model that's already active, turn it off
    if (modelType === specializedModel) {
      switchToModel(null, null);
    } else {
      // Save current settings before switching
      saveCurrentSettings();
      
      // Switch to the selected model
      switchToModel(modelType, modelObj);
    }
  };
  
  // Track message count to detect when a new message is added
  useEffect(() => {
    // Only update if the count has changed to avoid unnecessary rerenders
    if (messages.length !== messageCount) {
      setMessageCount(messages.length);
    }
  }, [messages, messageCount]);
  
  // Set up keyboard shortcuts for specialized models
  useEffect(() => {
    // Alt+0: Always switch to Agent mode
    Mousetrap.bind('alt+0', () => {
      // Always switch to Agent mode
      handleSelect(null, null);
      return false;
    });
    
    Mousetrap.bind('alt+1', () => {
      // If DeepSearch is already active, turn it off (go back to Agent)
      // Otherwise, turn on DeepSearch
      if (specializedModel === 'Deep-Searcher-Pro') {
        // Toggle back to Agent mode
        handleSelect(null, null);
      } else {
        // Switch to DeepSearch
        handleSelect('Deep-Searcher-Pro', deepSearcherModel);
      }
      return false;
    });
    
    Mousetrap.bind('alt+2', () => {
      // If DeepThought is already active, turn it off (go back to Agent)
      // Otherwise, turn on DeepThought
      if (specializedModel === 'Deep-Thinker-R1') {
        // Toggle back to Agent mode
        handleSelect(null, null);
      } else {
        // Switch to DeepThought
        handleSelect('Deep-Thinker-R1', deepThoughtModel);
      }
      return false;
    });
    
    Mousetrap.bind('alt+3', () => {
      // If Flash is already active, turn it off (go back to Agent)
      // Otherwise, turn on Flash
      if (specializedModel === 'Flash 2.5') {
        // Toggle back to Agent mode
        handleSelect(null, null);
      } else {
        // Switch to Flash
        handleSelect('Flash 2.5', flashModel);
      }
      return false;
    });
    
    return () => {
      Mousetrap.unbind('alt+0');
      Mousetrap.unbind('alt+1');
      Mousetrap.unbind('alt+2');
      Mousetrap.unbind('alt+3');
    };
  }, [deepSearcherModel, deepThoughtModel, flashModel, specializedModel]);
  
  // Check for tooltip content based on model
  const getTooltipContent = (modelType: string | null = specializedModel) => {
    switch(modelType) {
      case 'Deep-Searcher-Pro':
        return (
          <div style={{ maxWidth: "280px" }}>
            <p className="font-bold mb-1">Internet-Connected Research (Alt+1)</p>
            <ul className="list-disc pl-4 mb-1 space-y-1">
              <li>Searches the web more intensively for current information</li>
              <li>Uses a wider range of sources for comprehensive research</li>
              <li>Works harder to provide detailed, well-cited responses</li>
              <li className="font-semibold text-xs mt-1">Press Alt+1 again to return to Agent02</li>
            </ul>
          </div>
        );
      case 'Deep-Thinker-R1':
        return (
          <div style={{ maxWidth: "280px" }}>
            <p className="font-bold mb-1">Advanced Reasoning & Analysis (Alt+2)</p>
            <ul className="list-disc pl-4 mb-1 space-y-1">
              <li>Expert at complex problem-solving and logical reasoning</li>
              <li>Provides thorough, step-by-step explanations</li>
              <li>Ideal for mathematics, coding, and analytical tasks</li>
              <li className="font-semibold text-xs mt-1">Press Alt+2 again to return to Agent02</li>
            </ul>
          </div>
        );
      case 'Flash 2.5':
        return (
          <div style={{ maxWidth: "280px" }}>
            <p className="font-bold mb-1">Speed & Long Context (Alt+3)</p>
            <ul className="list-disc pl-4 mb-1 space-y-1">
              <li>Processes information rapidly</li>
              <li>Handles extensive documents efficiently</li>
              <li>Provides quick, concise responses</li>
              <li className="font-semibold text-xs mt-1">Press Alt+3 again to return to Agent02</li>
            </ul>
          </div>
        );
      default:
        return (
          <div style={{ maxWidth: "280px" }}>
            <p className="font-bold mb-1">Specialized Models</p>
            <ul className="list-disc pl-4 mb-1 space-y-1">
              <li>DeepSearch: Web research (Alt+1)</li>
              <li>DeepThought: Complex reasoning (Alt+2)</li>
              <li>Flash: Speed & long context (Alt+3)</li>
              <li>Agent02: Default mode (Alt+0)</li>
              <li className="font-semibold text-xs mt-1">Each shortcut toggles between model and Agent02</li>
            </ul>
          </div>
        );
    }
  };
  
  // Render a specific model button
  const renderModelButton = (modelType: string, modelObj: any, icon: React.ReactNode, label: string) => {
    const isActive = specializedModel === modelType;
    
    return (
      <Tooltip
        content={{ children: getTooltipContent(modelType) }}
        positioning="above"
        withArrow
        relationship="label"
      >
        <Button
          appearance={isActive ? "primary" : "subtle"}
          onClick={() => handleSelect(isActive ? null : modelType, isActive ? null : modelObj)}
          disabled={!modelObj}
          className={getButtonColor(modelType, isActive)}
          style={{ position: 'relative' }}
        >
          <span className="flex items-center font-medium">
            {icon}
            {label}
            {modelType === 'Deep-Searcher-Pro' && (
              <span className="ml-0.5 text-[7px] font-black align-super relative top-[-2px]" style={{ color: '#ff1493' }}>PRO</span>
            )}
            {isActive && (
               <DismissCircle16Regular 
                  className="ml-1 cursor-pointer inline-block"
                  style={{ verticalAlign: 'middle' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(null, null);
                  }}
                />
            )}
          </span>
        </Button>
      </Tooltip>
    );
  };

  // Render the component with either expanded buttons or collapsed dropdown
  return (
    <div className="flex items-center ml-0.5 gap-2" ref={containerRef}>
      {isCollapsed ? (
        // Collapsed view - dropdown menu
        <Tooltip
          content={{ children: getTooltipContent() }}
          positioning="above"
          withArrow
          relationship="label"
        >
          <span>
            <Menu open={open} onOpenChange={(e, data) => setOpen(data.open)}>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance={hasSpecializedModel ? "primary" : "subtle"}
                  className={getButtonColor(specializedModel || '', hasSpecializedModel)}
                >
                  <span className="flex items-center font-medium">
                    {getIcon()}
                    {getDisplayName()}
                    {!hasSpecializedModel && <ChevronDown16Regular className="ml-1" />}
                    {specializedModel === 'Deep-Searcher-Pro' && (
                      <span className="ml-0.5 text-[7px] font-black align-super relative top-[-2px]" style={{ color: '#ff1493' }}>PRO</span>
                    )}
                    {hasSpecializedModel && (
                      <DismissCircle16Regular 
                        className="ml-1 cursor-pointer inline-block"
                        style={{ verticalAlign: 'middle' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(null, null);
                        }}
                      />
                    )}
                  </span>
                </Button>
              </MenuTrigger>
              <MenuPopover className={theme === 'dark' ? 'dark-theme' : ''}>
                <MenuList>
                  <MenuItem 
                    icon={<Globe16Regular style={{ color: '#0078d4' }} />}
                    onClick={() => handleSelect('Deep-Searcher-Pro', deepSearcherModel)}
                    className={specializedModel === 'Deep-Searcher-Pro' ? (theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100') : ''}
                  >
                    <span className="flex items-center">
                      DeepSearch
                      <span className="ml-0.5 text-[7px] font-black align-super relative top-[-2px]" style={{ color: '#ff1493' }}>PRO</span>
                    </span>
                  </MenuItem>
                  
                  <MenuItem 
                    icon={<BrainCircuit20Regular style={{ color: '#8b5cf6' }} />}
                    onClick={() => handleSelect('Deep-Thinker-R1', deepThoughtModel)}
                    className={specializedModel === 'Deep-Thinker-R1' ? (theme === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100') : ''}
                  >
                    DeepThought
                  </MenuItem>
                  
                  <MenuItem 
                    icon={<Flash16Regular style={{ color: '#f97316' }} />}
                    onClick={() => handleSelect('Flash 2.5', flashModel)}
                    className={specializedModel === 'Flash 2.5' ? (theme === 'dark' ? 'bg-orange-900/50' : 'bg-orange-100') : ''}
                  >
                    Flash
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </span>
        </Tooltip>
      ) : (
        // Expanded view - individual buttons for each model
        <>
          {renderModelButton(
            'Deep-Searcher-Pro', 
            deepSearcherModel, 
            <Globe16Regular className="mr-1" style={{ color: theme === 'dark' ? '#4da3ff' : '#0078d4' }} />, 
            'DeepSearch'
          )}
          
          {renderModelButton(
            'Deep-Thinker-R1', 
            deepThoughtModel, 
            <BrainCircuit20Regular className="mr-1" style={{ color: theme === 'dark' ? '#a78bfa' : '#8b5cf6' }} />, 
            'DeepThought'
          )}
          
          {renderModelButton(
            'Flash 2.5', 
            flashModel, 
            <Flash16Regular className="mr-1" style={{ color: theme === 'dark' ? '#fb923c' : '#f97316' }} />, 
            'Flash'
          )}
        </>
      )}

      <style>{`
        /* Dark mode styles for the specialized models popup */
        .dark-theme.fui-MenuPopover {
          background-color: #1f2937 !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
        }
        
        .dark-theme .fui-MenuList {
          background-color: transparent !important;
          color: white !important;
        }
        
        .dark-theme .fui-MenuItem {
          color: white !important;
        }
        
        .dark-theme .fui-MenuItem:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
        }
      `}</style>
    </div>
  );
} 