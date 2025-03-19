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
  DismissCircle16Regular
} from '@fluentui/react-icons';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IChat, IChatContext } from 'intellichat/types';
import useChatStore from 'stores/useChatStore';
import useProvider from 'hooks/useProvider';
import useSettingsStore from 'stores/useSettingsStore';

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
  
  // State for menu and responsive layout
  const [open, setOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
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
    allModels.find(model => model.label === 'Flash-2.0' || model.name === 'google/gemini-2.0-flash-001'),
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
      // This should be the last component to collapse, at 800px
      setIsCollapsed(availableWidth < 800);
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
      case 'Deep-Searcher-R1': return <Search16Regular className="mr-1" style={{ color: '#0078d4' }} />;
      case 'Deep-Thinker-R1': return <BrainCircuit20Regular className="mr-1" style={{ color: '#8b5cf6' }} />;
      case 'Flash-2.0': return <Flash16Regular className="mr-1" style={{ color: '#f97316' }} />;
      default: return null;
    }
  };
  
  // Get display name based on selected model
  const getDisplayName = () => {
    switch(specializedModel) {
      case 'Deep-Searcher-R1': return 'DeepSearch';
      case 'Deep-Thinker-R1': return 'DeepThought';
      case 'Flash-2.0': return 'Flash';
      default: return 'Specialized';
    }
  };
  
  // Get button color based on selected model
  const getButtonColor = (modelType: string, isActive = true) => {
    if (!isActive) return 'px-2 py-0.5 text-sm';
    
    switch(modelType) {
      case 'Deep-Searcher-R1': return 'bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 text-sm'; // Blue
      case 'Deep-Thinker-R1': return 'bg-purple-500 hover:bg-purple-600 text-white px-2 py-0.5 text-sm'; // Purple
      case 'Flash-2.0': return 'bg-orange-500 hover:bg-orange-600 text-white px-2 py-0.5 text-sm'; // Orange
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
          maxCtxMessages: maxCtxMessagesRef.current
        });
      }
    } else {
      // Disable specialized model
      setSpecializedModel(null);
      
      // Enable OMNI Agent
      setAutoEnabled(true);
      
      // Get the OMNI Agent model
      const agentModel = allModels.find(model => model.autoEnabled === true || model.agentEnabled === true);
      
      // Switch back to OMNI Agent model
      if (agentModel) {
        editStage(chat.id, { 
          model: agentModel.label,
          // Keep the same settings
          systemMessage: systemMessageRef.current,
          temperature: temperatureRef.current,
          maxTokens: maxTokensRef.current,
          maxCtxMessages: maxCtxMessagesRef.current
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
  
  // When message count increases and a specialized model is enabled, disable it and switch back
  useEffect(() => {
    // Only run this effect when the message count changes
    if (!specializedModel || messages.length <= messageCount) {
      return;
    }
    
    // Check if we have at least one user message and one assistant message
    // This ensures we only switch back after getting a response from the model
    const userMessageCount = messages.filter(m => m.prompt && m.prompt.trim() !== '').length;
    const assistantMessageCount = messages.filter(m => m.reply && m.reply.trim() !== '').length;
    
    // Only switch back if we've received a response (assistant message count matches user message count)
    if (userMessageCount > 0 && assistantMessageCount > 0 && assistantMessageCount >= userMessageCount - 1) {
      // Create a local variable to avoid multiple state updates
      const newMessageCount = messages.length;
      
      // Only perform state updates if we have a valid model to switch to
      const agentModel = allModels.find(model => model.autoEnabled === true || model.agentEnabled === true);
      
      if (agentModel) {
        // Batch state updates by using a single useEffect execution
        // First update the message count to prevent re-entry
        setMessageCount(newMessageCount);
        
        // Then update model states
        setSpecializedModel(null);
        setAutoEnabled(true);
        
        // Finally update the chat model
        editStage(chat.id, { 
          model: agentModel.label,
          // Keep the same settings
          systemMessage: systemMessageRef.current,
          temperature: temperatureRef.current,
          maxTokens: maxTokensRef.current,
          maxCtxMessages: maxCtxMessagesRef.current
        });
      }
    }
  }, [messages, specializedModel, allModels, chat.id, editStage, setSpecializedModel, setAutoEnabled, messageCount]);
  
  // Check for tooltip content based on model
  const getTooltipContent = (modelType: string | null = specializedModel) => {
    switch(modelType) {
      case 'Deep-Searcher-R1':
        return (
          <div style={{ maxWidth: "280px" }}>
            <p className="font-bold mb-1">Internet-Connected Research</p>
            <ul className="list-disc pl-4 mb-1 space-y-1">
              <li>Searches the web more intensively for current information</li>
              <li>Uses a wider range of sources for comprehensive research</li>
              <li>Works harder to provide detailed, well-cited responses</li>
            </ul>
            <p className="text-xs italic mt-2">Returns to OMNI Agent after one response</p>
          </div>
        );
      case 'Deep-Thinker-R1':
        return (
          <div style={{ maxWidth: "280px" }}>
            <p className="font-bold mb-1">Advanced Reasoning & Analysis</p>
            <ul className="list-disc pl-4 mb-1 space-y-1">
              <li>Expert at complex problem-solving and logical reasoning</li>
              <li>Provides thorough, step-by-step explanations</li>
              <li>Ideal for mathematics, coding, and analytical tasks</li>
            </ul>
            <p className="text-xs italic mt-2">Returns to OMNI Agent after one response</p>
          </div>
        );
      case 'Flash-2.0':
        return (
          <div style={{ maxWidth: "280px" }}>
            <p className="font-bold mb-1">Speed & Long Context</p>
            <ul className="list-disc pl-4 mb-1 space-y-1">
              <li>Processes information rapidly</li>
              <li>Handles extensive documents efficiently</li>
              <li>Provides quick, concise responses</li>
            </ul>
            <p className="text-xs italic mt-2">Returns to OMNI Agent after one response</p>
          </div>
        );
      default:
        return (
          <div style={{ maxWidth: "280px" }}>
            <p className="font-bold mb-1">Specialized Models</p>
            <ul className="list-disc pl-4 mb-1 space-y-1">
              <li>DeepSearch: Web research with rich citations</li>
              <li>DeepThought: Complex reasoning & analysis</li>
              <li>Flash: Speed and long context processing</li>
            </ul>
            <p className="text-xs italic mt-2">Each returns to OMNI Agent after one response</p>
          </div>
        );
    }
  };
  
  // Render a specific model button
  const renderModelButton = (modelType: string, modelObj: any, icon: React.ReactNode, label: string, extraElement?: React.ReactNode) => {
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
          onClick={() => handleSelect(modelType, modelObj)}
          disabled={!modelObj}
          className={getButtonColor(modelType, isActive)}
        >
          <span className="flex items-center font-medium">
            {icon}
            {label}
            {modelType === 'Deep-Searcher-R1' && (
              <span className="ml-0.5 text-[7px] font-black align-super relative top-[-2px]" style={{ color: '#ff1493' }}>PRO</span>
            )}
            {extraElement}
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
                  {specializedModel === 'Deep-Searcher-R1' && (
                    <span className="ml-0.5 text-[7px] font-black align-super relative top-[-2px]" style={{ color: '#ff1493' }}>PRO</span>
                  )}
                  {hasSpecializedModel && (
                    <DismissCircle16Regular 
                      className="ml-1 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(null, null);
                      }}
                    />
                  )}
                </span>
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem 
                  icon={<Search16Regular style={{ color: '#0078d4' }} />}
                  onClick={() => handleSelect('Deep-Searcher-R1', deepSearcherModel)}
                  className={specializedModel === 'Deep-Searcher-R1' ? 'bg-blue-100 dark:bg-blue-900' : ''}
                >
                  <span className="flex items-center">
                    DeepSearch
                    <span className="ml-0.5 text-[7px] font-black align-super relative top-[-2px]" style={{ color: '#ff1493' }}>PRO</span>
                  </span>
                </MenuItem>
                
                <MenuItem 
                  icon={<BrainCircuit20Regular style={{ color: '#8b5cf6' }} />}
                  onClick={() => handleSelect('Deep-Thinker-R1', deepThoughtModel)}
                  className={specializedModel === 'Deep-Thinker-R1' ? 'bg-purple-100 dark:bg-purple-900' : ''}
                >
                  DeepThought
                </MenuItem>
                
                <MenuItem 
                  icon={<Flash16Regular style={{ color: '#f97316' }} />}
                  onClick={() => handleSelect('Flash-2.0', flashModel)}
                  className={specializedModel === 'Flash-2.0' ? 'bg-orange-100 dark:bg-orange-900' : ''}
                >
                  Flash
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </Tooltip>
      ) : (
        // Expanded view - individual buttons for each model
        <>
          {renderModelButton(
            'Deep-Searcher-R1', 
            deepSearcherModel, 
            <Search16Regular className="mr-1" style={{ color: '#0078d4' }} />, 
            'DeepSearch'
          )}
          
          {renderModelButton(
            'Deep-Thinker-R1', 
            deepThoughtModel, 
            <BrainCircuit20Regular className="mr-1" style={{ color: '#8b5cf6' }} />, 
            'DeepThought'
          )}
          
          {renderModelButton(
            'Flash-2.0', 
            flashModel, 
            <Flash16Regular className="mr-1" style={{ color: '#f97316' }} />, 
            'Flash'
          )}
        </>
      )}
    </div>
  );
} 