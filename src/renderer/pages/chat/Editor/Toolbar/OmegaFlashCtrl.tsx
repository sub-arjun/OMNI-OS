import {
  Button,
  Tooltip,
} from '@fluentui/react-components';
import { TextExpandRegular } from '@fluentui/react-icons';
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
  const omegaFlashEnabled = specializedModel === 'Flash-2.0';
  
  // Store the current system message, temperature, and other settings
  const systemMessageRef = useRef<string | null | undefined>(null);
  const temperatureRef = useRef<number | undefined>(undefined);
  const maxTokensRef = useRef<number | null | undefined>(undefined);
  const maxCtxMessagesRef = useRef<number | undefined>(undefined);
  
  // Get the Flash-2.0 model
  const provider = getProvider('OMNI');
  const allModels = getChatModels(provider.name) || [];
  // Use the label instead of the name to find the model
  const flashModel = allModels.find(model => model.name === 'google/gemini-2.0-flash-001' || model.label === 'Flash-2.0');
  
  // Handle button click
  const toggleOmegaFlash = () => {
    if (!omegaFlashEnabled) {
      // Enable Omega Flash
      
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
      setSpecializedModel('Flash-2.0');
      
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
          maxCtxMessages: maxCtxMessagesRef.current
        });
      }
    } else {
      // Disable Omega Flash
      
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
              <p className="font-bold mb-1">Ultra-Fast Responses</p>
              <ul className="list-disc pl-4 mb-1 space-y-1">
                <li>Optimized for speed and efficiency</li>
                <li>Handles extremely long documents</li>
                <li>Processes code and data rapidly</li>
              </ul>
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
            <SmallTextExpandIcon className="mr-1.5" />
            Flash
          </span>
        </Button>
      </Tooltip>
    </div>
  );
} 