import {
  Button,
  Tooltip,
} from '@fluentui/react-components';
import { TextExpandRegular, BrainCircuit20Regular } from '@fluentui/react-icons';
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IChat, IChatContext } from 'intellichat/types';
import useChatStore from 'stores/useChatStore';
import useProvider from 'hooks/useProvider';
import useSettingsStore from 'stores/useSettingsStore';

// Smaller version of the TextExpand icon
const SmallTextExpandIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <TextExpandRegular 
    {...props} 
    style={{ 
      ...props.style,
      width: '15px',
      height: '15px',
    }} 
  />
);

// Smaller version of the Brain icon
const SmallBrainIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <BrainCircuit20Regular 
    {...props} 
    style={{ 
      ...props.style,
      width: '15px',
      height: '15px',
    }} 
  />
);

export default function OmegaFlashCtrl({
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
  
  // Check if Omega Flash is currently enabled
  const omegaFlashEnabled = specializedModel === 'Flash 2.5';
  
  // Store the current system message, temperature, and other settings
  const systemMessageRef = useRef<string | null | undefined>(null);
  const temperatureRef = useRef<number | undefined>(undefined);
  const maxTokensRef = useRef<number | null | undefined>(undefined);
  const maxCtxMessagesRef = useRef<number | undefined>(undefined);
  
  // Get the Flash model
  const provider = getProvider('OMNI');
  const allModels = getChatModels(provider.name) || [];
  // Use the label instead of the name to find the model
  const flashModel = allModels.find(model => model.name === 'google/gemini-2.5-flash-preview:thinking' || model.label === 'Flash Big Brain');
  
  // Handle button click
  const toggleOmegaFlash = () => {
    // Get current input value to preserve it
    const currentInput = useChatStore.getState().chat.input || '';
    console.log("Preserving input when switching to Flash 2.5:", currentInput);
    
    if (!omegaFlashEnabled) {
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
      setSpecializedModel('Flash 2.5');
      
      // Ensure AUTO is disabled
      setAutoEnabled(false);
      
      if (flashModel) {
        // Switch to Omega Flash model
        editStage(chat.id, { 
          model: flashModel.label,
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
      // Disable Omega Flash
      
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
    // When specializedModel changes and Omega Flash is enabled, apply it to the current chat
    if (omegaFlashEnabled && flashModel && chat?.id) {
      editStage(chat.id, { 
        model: flashModel.label
      });
    }
  }, [omegaFlashEnabled, flashModel, chat?.id, editStage]);
  
  // Track message count to detect when a new message is added
  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages]);
  
  // Add an effect to handle switching back after receiving a response
  useEffect(() => {
    const currentMessages = useChatStore.getState().messages;
    if (!omegaFlashEnabled || currentMessages.length <= messageCount) {
      return;
    }
    
    // Get current input value to preserve it
    const currentInput = useChatStore.getState().chat.input || '';
    
    // Check if we have both prompt messages and replies
    const userMessageCount = currentMessages.filter(m => m.prompt && m.prompt.trim() !== '').length;
    const assistantMessageCount = currentMessages.filter(m => m.reply && m.reply.trim() !== '').length;
    
    // Only switch back if we've received a response
    if (userMessageCount > 0 && assistantMessageCount > 0 && assistantMessageCount >= userMessageCount - 1) {
      // Use a timeout to avoid React render cycle issues
      const timeoutId = setTimeout(() => {
      // Disable Omega Flash
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
  // Only depend on messageCount and omegaFlashEnabled to avoid continuous re-renders
  }, [messageCount, omegaFlashEnabled, chat.id, editStage, setSpecializedModel, setAutoEnabled, allModels]);
  
  // Always render the component, even if the model isn't found
  return (
    <div className="flex items-center ml-0.5">
      <Tooltip
        content={{
          children: (
            <div style={{ maxWidth: "280px" }}>
              <p className="font-bold mb-1">Ultra-Fast Responses with Enhanced Reasoning</p>
              <ul className="list-disc pl-4 mb-1 space-y-1">
                <li>Optimized for speed and efficiency</li>
                <li>Enhanced reasoning capabilities</li>
                <li>Handles extremely long documents</li>
                <li>Processes code and data rapidly</li>
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
          appearance={omegaFlashEnabled ? "primary" : "subtle"}
          onClick={toggleOmegaFlash}
          disabled={!flashModel}
          className={omegaFlashEnabled ? 'bg-orange-500 hover:bg-orange-600 text-white px-2 py-0.5 text-sm' : 'px-2 py-0.5 text-sm'}
        >
          <span className="flex items-center font-medium">
            <SmallTextExpandIcon className="mr-1" />
            <SmallBrainIcon className="mr-1" />
            Flash Big Brain
          </span>
        </Button>
      </Tooltip>
    </div>
  );
} 