import {
  Button,
  Tooltip,
} from '@fluentui/react-components';
import { BrainCircuitRegular, BrainCircuit20Regular, BrainCircuit20Filled } from '@fluentui/react-icons';
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IChat, IChatContext } from 'intellichat/types';
import useChatStore from 'stores/useChatStore';
import useProvider from 'hooks/useProvider';
import useSettingsStore from 'stores/useSettingsStore';

// Custom styled brain icons with purple color
const PurpleHeartBrainIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <BrainCircuit20Regular 
    {...props} 
    style={{ 
      ...props.style,
      color: '#e11d48', // Tailwind rose-600
    }} 
  />
);

const PurpleHeartBrainFilledIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <BrainCircuit20Filled 
    {...props} 
    style={{ 
      ...props.style,
      color: '#e11d48', // Tailwind rose-600
    }} 
  />
);

export default function DeepThoughtCtrl({
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
  
  // Check if Deep Thought is currently enabled
  const deepThoughtEnabled = specializedModel === 'Deep-Thinker-R1';
  
  // Store the current system message, temperature, and other settings
  const systemMessageRef = useRef<string | null | undefined>(null);
  const temperatureRef = useRef<number | undefined>(undefined);
  const maxTokensRef = useRef<number | null | undefined>(undefined);
  const maxCtxMessagesRef = useRef<number | undefined>(undefined);
  
  // Get the Deep-Thinker-R1 model
  const provider = getProvider('OMNI');
  const allModels = getChatModels(provider.name) || [];
  // Use the label instead of the name to find the model
  const deepThinkerModel = allModels.find(model => model.label === 'R1-1776' || model.name === 'perplexity/r1-1776');
  
  // Handle button click
  const toggleDeepThought = () => {
    // Get current input value to preserve it
    const currentInput = useChatStore.getState().chat.input || '';
    
    if (!deepThoughtEnabled) {
      // Enable Deep Thought
      
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
      setSpecializedModel('Deep-Thinker-R1');
      
      // Ensure AUTO is disabled
      setAutoEnabled(false);
      
      if (deepThinkerModel) {
        // Switch to Deep Thought model
        editStage(chat.id, { 
          model: deepThinkerModel.label,
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
      // Disable Deep Thought
      
      // Clear the specialized model
      setSpecializedModel(null);
      
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
          maxCtxMessages: maxCtxMessagesRef.current,
          // Preserve the current input text
          input: currentInput
        });
      }
    }
  };
  
  // Add effect to ensure the specialized model is applied to the current chat
  useEffect(() => {
    // When specializedModel changes and Deep Thought is enabled, apply it to the current chat
    if (deepThoughtEnabled && deepThinkerModel && chat?.id) {
      editStage(chat.id, { 
        model: deepThinkerModel.label
      });
    }
  }, [deepThoughtEnabled, deepThinkerModel, chat?.id, editStage]);
  
  // Track message count to detect when a new message is added
  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages]);
  
  // Add an effect to handle switching back after receiving a response
  useEffect(() => {
    // Store the current messages in a ref to avoid dependency changes
    const currentMessages = useChatStore.getState().messages;
    
    // Skip if not enabled or no new messages
    if (!deepThoughtEnabled || currentMessages.length <= messageCount) {
      return;
    }
    
    // Get current input value to preserve it
    const currentInput = useChatStore.getState().chat.input || '';
    
    // Check if we have both prompt messages and replies
    const userMessageCount = currentMessages.filter(m => m.prompt && m.prompt.trim() !== '').length;
    const assistantMessageCount = currentMessages.filter(m => m.reply && m.reply.trim() !== '').length;
    
    // Only switch back if we've received a response and store the action in a ref
    if (userMessageCount > 0 && assistantMessageCount > 0 && assistantMessageCount >= userMessageCount - 1) {
      // Use a timeout to avoid React render cycle issues
      const timeoutId = setTimeout(() => {
      // Disable Deep Thought
      setSpecializedModel(null);
      
        // Enable Agent02
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
          maxCtxMessages: maxCtxMessagesRef.current,
          // Preserve the current input text
          input: currentInput
        });
      }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  // Only depend on messageCount changes and deepThoughtEnabled to avoid continuous re-renders
  }, [messageCount, deepThoughtEnabled, chat.id, editStage, setSpecializedModel, setAutoEnabled, allModels]);
  
  // Always render the component, even if the model isn't found
  return (
    <div className="flex items-center ml-0.5">
      <Tooltip
        content={{
          children: (
            <div style={{ maxWidth: "280px" }}>
              <p className="font-bold mb-1">Advanced Reasoning & Analysis</p>
              <ul className="list-disc pl-4 mb-1 space-y-1">
                <li>Performs deep analytical thinking</li>
                <li>Excels at complex problem-solving</li>
                <li>Provides balanced, thoughtful responses</li>
              </ul>
              <p className="text-xs italic mt-2">Returns to Agent02 after use</p>
            </div>
          ),
        }}
        positioning="above"
        withArrow
        relationship="label"
      >
        <Button
          appearance={deepThoughtEnabled ? "primary" : "subtle"}
          onClick={toggleDeepThought}
          disabled={!deepThinkerModel}
          className={deepThoughtEnabled ? 'bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 text-sm' : 'px-2 py-0.5 text-sm'}
        >
          <span className="flex items-center font-medium">
            <BrainCircuitRegular className="mr-1" />
            DeepThought
          </span>
        </Button>
      </Tooltip>
    </div>
  );
} 