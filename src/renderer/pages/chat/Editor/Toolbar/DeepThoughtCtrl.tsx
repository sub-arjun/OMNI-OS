import {
  Button,
  Tooltip,
} from '@fluentui/react-components';
import { BrainCircuitRegular } from '@fluentui/react-icons';
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
          maxCtxMessages: maxCtxMessagesRef.current
        });
      }
    } else {
      // Disable Deep Thought
      
      // Clear the specialized model
      setSpecializedModel(null);
      
      // Enable AUTO
      setAutoEnabled(true);
      
      // Get the AUTO model
      const autoModel = allModels.find(model => model.autoEnabled === true);
      
      // Switch back to AUTO model
      if (autoModel) {
        // Switch to AUTO model with the same settings
        editStage(chat.id, { 
          model: autoModel.label,
          // Keep the same settings
          systemMessage: systemMessageRef.current,
          temperature: temperatureRef.current,
          maxTokens: maxTokensRef.current,
          maxCtxMessages: maxCtxMessagesRef.current
        });
      }
    }
  };
  
  // Track message count to detect when a new message is added
  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages]);
  
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