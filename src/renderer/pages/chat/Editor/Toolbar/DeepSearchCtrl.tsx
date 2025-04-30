import {
  Button,
  Tooltip,
} from '@fluentui/react-components';
import { BrainCircuit20Regular, BrainCircuit20Filled, Search16Regular } from '@fluentui/react-icons';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { IChat, IChatContext } from 'intellichat/types';
import useChatStore from 'stores/useChatStore';
import useProvider from 'hooks/useProvider';
import useSettingsStore from 'stores/useSettingsStore';

// Custom styled brain icons with purple color
const PurpleBrainIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <BrainCircuit20Regular 
    {...props} 
    style={{ 
      ...props.style,
      color: '#8b5cf6', // Tailwind purple-500
    }} 
  />
);

const PurpleBrainFilledIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <BrainCircuit20Filled 
    {...props} 
    style={{ 
      ...props.style,
      color: '#8b5cf6', // Tailwind purple-500
    }} 
  />
);

// Track active timeouts to clean them up properly
const activeTimeouts: Set<NodeJS.Timeout> = new Set();

// Helper function to create a timeout that is automatically tracked for cleanup
const createTrackedTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
  const timeoutId = setTimeout(() => {
    callback();
    activeTimeouts.delete(timeoutId);
  }, delay);
  activeTimeouts.add(timeoutId);
  return timeoutId;
};

// Helper function to clean up all tracked timeouts
const cleanupAllTimeouts = () => {
  activeTimeouts.forEach(id => {
    clearTimeout(id);
  });
  activeTimeouts.clear();
};

// Track if we're currently in a model transition to prevent duplicate operations
let isTransitioning = false;

// Keep a debounce timeout for message checking
let messageCheckTimeout: NodeJS.Timeout | null = null;

// Use a global variable to track last successful state updates
const lastStateChange = {
  time: 0,
  modelType: ''
};

export default function DeepSearchCtrl({
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
  const [previousModel, setPreviousModel] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState<number>(0);
  const editStage = useChatStore((state) => state.editStage);
  const messages = useChatStore((state) => state.messages);
  const { getProvider, getChatModels } = useProvider();
  
  // Use refs to track current state to avoid stale closures
  const isEnabledRef = useRef(false);
  const lastUpdateRef = useRef(0);
  
  // Update ref when specialized model changes
  useEffect(() => {
    isEnabledRef.current = specializedModel === 'Deep-Searcher-Pro';
  }, [specializedModel]);
  
  // Store previous message count to compare
  const prevMessageCountRef = useRef(0);
  
  // Cleanup timeouts when component unmounts
  useEffect(() => {
    return () => {
      cleanupAllTimeouts();
      if (messageCheckTimeout) {
        clearTimeout(messageCheckTimeout);
        messageCheckTimeout = null;
      }
      isTransitioning = false;
    };
  }, []);
  
  // Check if Deep Search is currently enabled
  const deepSearchEnabled = specializedModel === 'Deep-Searcher-Pro';
  
  // Store the current system message, temperature, and other settings
  const systemMessageRef = useRef<string | null | undefined>(null);
  const temperatureRef = useRef<number | undefined>(undefined);
  const maxTokensRef = useRef<number | null | undefined>(undefined);
  const maxCtxMessagesRef = useRef<number | undefined>(undefined);
  
  // Get the Deep-Searcher-Pro model - memoize to prevent frequent recalculation
  const provider = useMemo(() => getProvider('OMNI'), [getProvider]);
  const allModels = useMemo(() => getChatModels(provider.name) || [], [getChatModels, provider.name]);
  
  // Use the correct model name/label from OMNI.ts
  const deepSearcherModel = useMemo(() => 
    allModels.find(model => 
      model.name === 'perplexity/sonar-reasoning-pro' || 
      model.label === 'Sonar Reasoning' || 
      model.label === 'Deep-Searcher-Pro'
    ),
    [allModels]
  );
  
  // Safe state update function with rate limiting
  const safeSetSpecializedModel = useCallback((modelType: string | null) => {
    const now = Date.now();
    // Prevent updates too close together (within 3 seconds)
    if (now - lastStateChange.time < 3000 && lastStateChange.modelType === modelType) {
      return false; // Skip this update, it's too soon
    }
    
    // Update global tracker
    lastStateChange.time = now;
    lastStateChange.modelType = modelType || '';
    
    // Update the state
    setSpecializedModel(modelType);
    return true; // Update was processed
  }, [setSpecializedModel]);
  
  // Handle button click with debounce to prevent double-triggers
  const toggleDeepSearch = useCallback(() => {
    if (isTransitioning) return;
    
    isTransitioning = true;
    setTimeout(() => { isTransitioning = false; }, 1000);
    
    if (!deepSearchEnabled) {
      // Enable Deep Search
      
      // Save current model and settings
      const currentModel = ctx.getModel();
      if (currentModel.label) {
        setPreviousModel(currentModel.label);
      }
      
      // Save current settings
      systemMessageRef.current = ctx.getSystemMessage();
      temperatureRef.current = ctx.getTemperature();
      maxTokensRef.current = ctx.getMaxTokens();
      maxCtxMessagesRef.current = chat.maxCtxMessages;
      
      // Update the specialized model
      safeSetSpecializedModel('Deep-Searcher-Pro');
      
      // Ensure AUTO is disabled
      setAutoEnabled(false);
      
      if (deepSearcherModel) {
        // Switch to Deep Search model
        editStage(chat.id, { 
          model: deepSearcherModel.label,
          // Keep the same settings
          systemMessage: systemMessageRef.current,
          temperature: temperatureRef.current,
          maxTokens: maxTokensRef.current,
          maxCtxMessages: maxCtxMessagesRef.current
        });
      }
    } else {
      // Disable Deep Search
      
      // Clean up all tracked timeouts to prevent memory leaks
      cleanupAllTimeouts();
      
      // Clear the specialized model
      safeSetSpecializedModel(null);
      
      // Enable Agent02 (previously AUTO/Agent)
      setAutoEnabled(true);
      
      // Get the Agent02 model
      const agentModel = allModels.find(model => model.autoEnabled === true || model.agentEnabled === true);
      
      // Switch back to Agent02 model
      if (agentModel) {
        // Switch to Agent02 model with the same settings
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
  }, [deepSearchEnabled, ctx, chat.id, chat.maxCtxMessages, deepSearcherModel, allModels, editStage, safeSetSpecializedModel, setAutoEnabled]);
  
  // Optimized effect for message count tracking - uses debounce and ref comparison to minimize renders
  useEffect(() => {
    // Throttle updates to avoid infinite loops
    const now = Date.now();
    if (now - lastUpdateRef.current < 1000) {
      return; // Skip this update cycle if less than 1 second since last update
    }
    lastUpdateRef.current = now;
    
    // Clear any existing timeout
    if (messageCheckTimeout) {
      clearTimeout(messageCheckTimeout);
    }
    
    // Debounce the message count check to reduce frequency
    messageCheckTimeout = setTimeout(() => {
      const currentMessages = useChatStore.getState().messages;
      const currentCount = currentMessages.length;
      
      // Only update state if necessary (different count)
      if (currentCount !== prevMessageCountRef.current) {
        prevMessageCountRef.current = currentCount;
        
        // Use setTimeout to further decouple the state update
        setTimeout(() => {
          setMessageCount(currentCount);
        }, 0);
        
        // Check for auto-disable immediately if deep search is enabled
        if (isEnabledRef.current && currentCount > messageCount) {
          // We have a new message
          
          // Check if we have both prompt messages and replies
          const userMessageCount = currentMessages.filter(m => m.prompt && m.prompt.trim() !== '').length;
          const assistantMessageCount = currentMessages.filter(m => m.reply && m.reply.trim() !== '').length;
          
          // Only switch back if we've received a response
          if (userMessageCount > 0 && assistantMessageCount > 0 && assistantMessageCount >= userMessageCount - 1) {
            if (isTransitioning) return;
            isTransitioning = true;
            
            // Disable deep search after a short delay
            createTrackedTimeout(() => {
              // Avoid state updates if component is unmounting or already transitioning
              if (!isEnabledRef.current) {
                isTransitioning = false;
                return;
              }
              
              // Disable deep search
              const updated = safeSetSpecializedModel(null);
              
              // Only continue with other changes if the model update went through
              if (updated) {
                // Enable Agent02
                setAutoEnabled(true);
                
                // Get the Agent02 model
                const agentModel = allModels.find(model => model.autoEnabled === true || model.agentEnabled === true);
                
                // Switch back to Agent02 model
                if (agentModel) {
                  // Use a slight delay to avoid rapid sequential updates
                  setTimeout(() => {
                    editStage(chat.id, { 
                      model: agentModel.label,
                      systemMessage: systemMessageRef.current,
                      temperature: temperatureRef.current,
                      maxTokens: maxTokensRef.current,
                      maxCtxMessages: maxCtxMessagesRef.current
                    });
                  }, 100);
                }
              }
              
              // Reset transition flag
              setTimeout(() => {
                isTransitioning = false;
              }, 1000);
              
              // Force cleanup to recover memory
              if (typeof globalThis.gc === 'function') {
                try {
                  globalThis.gc();
                } catch (e) {
                  // Ignore GC errors
                }
              }
            }, 500); // Increased delay to prevent rapid state changes
          }
        }
      }
    }, 1000); // Increased debounce to 1 second
    
    return () => {
      if (messageCheckTimeout) {
        clearTimeout(messageCheckTimeout);
        messageCheckTimeout = null;
      }
    };
  }, [messages, allModels, chat.id, editStage, messageCount, setAutoEnabled, safeSetSpecializedModel]);
  
  // Always render the component, even if the model isn't found
  return (
    <div className="flex items-center ml-0.5">
      <Tooltip
        content={{
          children: (
            <div style={{ maxWidth: "280px" }}>
              <p className="font-bold mb-1">Internet-Connected Research</p>
              <ul className="list-disc pl-4 mb-1 space-y-1">
                <li>Searches the web more intensively for current information</li>
                <li>Uses a wider range of sources for comprehensive research</li>
                <li>Works harder to provide detailed, well-cited responses</li>
              </ul>
              <p className="text-xs italic mt-2">Returns to Agent02 after one response</p>
            </div>
          ),
        }}
        positioning="above"
        withArrow
        relationship="label"
      >
        <Button
          appearance={deepSearchEnabled ? "primary" : "subtle"}
          onClick={toggleDeepSearch}
          disabled={!deepSearcherModel || isTransitioning}
          className={deepSearchEnabled ? 'bg-purple-500 hover:bg-purple-600 text-white px-2 py-0.5 text-sm' : 'px-2 py-0.5 text-sm'}
        >
          <span className="flex items-center font-medium">
            <Search16Regular className="mr-1" />
            DeepSearch
            <span className="ml-0.5 text-[7px] text-purple-400 font-semibold align-super relative top-[-2px]">PRO</span>
          </span>
        </Button>
      </Tooltip>
    </div>
  );
} 