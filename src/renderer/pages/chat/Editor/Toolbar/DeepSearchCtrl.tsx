import {
  Button,
  Tooltip,
} from '@fluentui/react-components';
import { BrainCircuit20Regular, BrainCircuit20Filled } from '@fluentui/react-icons';
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IChat, IChatContext } from 'intellichat/types';
import useChatStore from 'stores/useChatStore';
import useProvider from 'hooks/useProvider';
import SearchStatusIndicator from 'renderer/components/SearchStatusIndicator';

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
  const [deepSearchEnabled, setDeepSearchEnabled] = useState<boolean>(false);
  const [previousModel, setPreviousModel] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState<number>(0);
  const editStage = useChatStore((state) => state.editStage);
  const messages = useChatStore((state) => state.messages);
  const { getProvider, getChatModels } = useProvider();
  
  // Store the current system message, temperature, and other settings
  const systemMessageRef = useRef<string | null | undefined>(null);
  const temperatureRef = useRef<number | undefined>(undefined);
  const maxTokensRef = useRef<number | null | undefined>(undefined);
  const maxCtxMessagesRef = useRef<number | undefined>(undefined);
  
  // Get the Deep-Searcher-R1 model
  const provider = getProvider('OMNI');
  const allModels = getChatModels(provider.name) || [];
  // Use the label instead of the name to find the model
  const deepSearcherModel = allModels.find(model => model.label === 'Sonar Reasoning' || model.name === 'perplexity/sonar-reasoning');
  
  // For debugging
  useEffect(() => {
    console.log('DeepSearchCtrl mounted');
    console.log('Provider:', provider.name);
    console.log('All models:', allModels.map(m => m.name));
    console.log('Deep-Searcher-R1 model found:', !!deepSearcherModel);
  }, []);
  
  // Handle button click
  const toggleDeepSearch = () => {
    const newState = !deepSearchEnabled;
    setDeepSearchEnabled(newState);
    
    if (newState) {
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
      // Switch back to previous model
      if (previousModel) {
        // Switch back to previous model with the same settings
        editStage(chat.id, { 
          model: previousModel,
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
  
  // When message count increases and deep search is enabled, disable it and switch back
  useEffect(() => {
    const currentMessages = useChatStore.getState().messages;
    if (deepSearchEnabled && currentMessages.length > messageCount) {
      // Disable deep search and switch back to previous model
      setDeepSearchEnabled(false);
      if (previousModel) {
        // Switch back to previous model with the same settings
        editStage(chat.id, { 
          model: previousModel,
          // Keep the same settings
          systemMessage: systemMessageRef.current,
          temperature: temperatureRef.current,
          maxTokens: maxTokensRef.current,
          maxCtxMessages: maxCtxMessagesRef.current
        });
      }
    }
  }, [messages, messageCount, deepSearchEnabled, previousModel, chat.id, editStage]);
  
  // Always render the component, even if the model isn't found
  return (
    <div className="flex items-center ml-2">
      <Tooltip
        content={{
          children: (
            <div style={{ maxWidth: "280px" }}>
              <p className="font-bold mb-1">Deep Online Research</p>
              <ul className="list-disc pl-4 mb-1 space-y-1">
                <li>Searches the web for current information</li>
                <li>Plans and executes research strategies</li>
                <li>Provides factual, cited responses</li>
              </ul>
              <p className="text-xs italic mt-2">Returns to your previous model after one response</p>
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
          icon={deepSearchEnabled ? <PurpleBrainFilledIcon /> : <PurpleBrainIcon />}
          className={deepSearchEnabled ? 'bg-purple-500 hover:bg-purple-600 text-white' : ''}
        >
          <span className="flex items-center font-medium">
            DeepSearch
            <span className="ml-1">🔍</span>
          </span>
        </Button>
      </Tooltip>
    </div>
  );
} 