import {
  Button,
  Tooltip,
} from '@fluentui/react-components';
import { BrainCircuit20Regular, BrainCircuit20Filled, Search16Regular } from '@fluentui/react-icons';
import { useEffect, useState, useRef } from 'react';
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
  
  // Check if Deep Search is currently enabled
  const deepSearchEnabled = specializedModel === 'Deep-Searcher-R1';
  
  // Store the current system message, temperature, and other settings
  const systemMessageRef = useRef<string | null | undefined>(null);
  const temperatureRef = useRef<number | undefined>(undefined);
  const maxTokensRef = useRef<number | null | undefined>(undefined);
  const maxCtxMessagesRef = useRef<number | undefined>(undefined);
  
  // Get the Deep-Searcher-R1 model
  const provider = getProvider('OMNI');
  const allModels = getChatModels(provider.name) || [];
  // Use the correct model name/label from OMNI.ts
  const deepSearcherModel = allModels.find(model => 
    model.name === 'perplexity/sonar-reasoning-pro' || 
    model.label === 'Sonar Reasoning' || 
    model.label === 'Deep-Searcher-Pro'
  );
  
  // Handle button click
  const toggleDeepSearch = () => {
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
      setSpecializedModel('Deep-Searcher-R1');
      
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
      
      // Clear the specialized model
      setSpecializedModel(null);
      
      // Enable OMNI Agent (previously AUTO/Agent)
      setAutoEnabled(true);
      
      // Get the OMNI Agent model
      const agentModel = allModels.find(model => model.autoEnabled === true || model.agentEnabled === true);
      
      // Switch back to OMNI Agent model
      if (agentModel) {
        // Switch to OMNI Agent model with the same settings
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
  };
  
  // Add effect to ensure the specialized model is applied to the current chat
  useEffect(() => {
    // When specializedModel changes and Deep Search is enabled, apply it to the current chat
    if (deepSearchEnabled && deepSearcherModel && chat?.id) {
      editStage(chat.id, { 
        model: deepSearcherModel.label
      });
    }
  }, [deepSearchEnabled, deepSearcherModel, chat?.id, editStage]);
  
  // Track message count to detect when a new message is added
  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages]);
  
  // When message count increases and deep search is enabled, disable it and switch back
  useEffect(() => {
    const currentMessages = useChatStore.getState().messages;
    if (!deepSearchEnabled || currentMessages.length <= messageCount) {
      return;
    }
    
    // Check if we have both prompt messages and replies
    const userMessageCount = currentMessages.filter(m => m.prompt && m.prompt.trim() !== '').length;
    const assistantMessageCount = currentMessages.filter(m => m.reply && m.reply.trim() !== '').length;
    
    // Only switch back if we've received a response
    if (userMessageCount > 0 && assistantMessageCount > 0 && assistantMessageCount >= userMessageCount - 1) {
      // Disable deep search
      setSpecializedModel(null);
      
      // Enable OMNI Agent (previously AUTO)
      setAutoEnabled(true);
      
      // Get the OMNI Agent model (previously AUTO)
      const agentModel = allModels.find(model => model.autoEnabled === true || model.agentEnabled === true);
      
      // Switch back to OMNI Agent model
      if (agentModel) {
        // Switch to OMNI Agent model with the same settings
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
  }, [messages, messageCount, deepSearchEnabled, previousModel, chat.id, editStage, setSpecializedModel, setAutoEnabled, allModels]);
  
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
              <p className="text-xs italic mt-2">Returns to OMNI Agent after one response</p>
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
          disabled={!deepSearcherModel}
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