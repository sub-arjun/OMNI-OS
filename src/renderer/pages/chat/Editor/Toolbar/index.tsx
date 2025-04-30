import { Toolbar } from '@fluentui/react-components';
import { useState, useEffect, useRef, useCallback } from 'react';
import useChatContext from 'hooks/useChatContext';
import ModelCtrl from './ModelCtrl';
import DeepSearchCtrl from './DeepSearchCtrl';
import DeepThoughtCtrl from './DeepThoughtCtrl';
import OmegaFlashCtrl from './OmegaFlashCtrl';
import PromptCtrl from './PromptCtrl';
import TemperatureCtrl from './TemperatureCtrl';
import MaxTokensCtrl from './MaxTokensCtrl';
import ImgCtrl from './ImgCtrl';
import StreamCtrl from './StreamCtrl';
import KnowledgeCtrl from './KnowledgeCtrl';
import CtxNumCtrl from './CtxNumCtrl';
import SpeechCtrl from './SpeechCtrl';
import ToolCtrl from './ToolCtrl';
import { Button, Popover, PopoverSurface, PopoverTrigger, Tooltip } from '@fluentui/react-components';
import { BrainCircuit20Regular } from '@fluentui/react-icons';
import SpecializedModelsCtrl from './SpecializedModelsCtrl';
import ErrorBoundary from 'renderer/components/ErrorBoundary';
import Spinner from 'renderer/components/Spinner';
import useChatStore from 'stores/useChatStore';
import { useTranslation } from 'react-i18next';

interface EditorToolbarProps {
  onConfirm: () => void;
}

export default function EditorToolbar({
  onConfirm,
}: EditorToolbarProps) {
  const ctx = useChatContext();
  const provider = ctx.getProvider();
  const activeChat = ctx.getActiveChat();
  const states = useChatStore().getCurState();
  const chatLoading = states.loading;
  const { t } = useTranslation();
  const model = ctx.getModel();
  const hasVisionSupport = model?.vision?.enabled || false;
  const isOllamaProvider = provider.name === 'Ollama';
  
  // State for parameters popup
  const [parametersPopupOpen, setParametersPopupOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  // Handle parameters popup
  const toggleParametersPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    setParametersPopupOpen(!parametersPopupOpen);
  };
  
  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const popupEl = document.querySelector('.parameters-popup');
      const triggerBtn = document.querySelector('.parameters-trigger');
      
      if (parametersPopupOpen && 
          popupEl && 
          !popupEl.contains(e.target as Node) && 
          triggerBtn && 
          !triggerBtn.contains(e.target as Node)) {
        setParametersPopupOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [parametersPopupOpen]);

  // Wrap renderToolbar in useCallback
  const renderToolbar = useCallback(() => {
    // Determine flags inside useCallback based on dependencies
    const hasModelSelect = true; // Assuming always true, adjust if needed
    const hasPromptSelect = true; // Assuming always true, adjust if needed
    const hasParams = true; // Assuming always true, adjust if needed

    return (
      <Toolbar
        ref={toolbarRef}
        aria-label="Default"
        size="small"
        className="flex items-center gap-3 editor-toolbar"
      >
        {/* Section 1: Model selector */}
        {hasModelSelect && (
          <ErrorBoundary componentName="ModelCtrl">
            <ModelCtrl ctx={ctx} chat={activeChat} />
          </ErrorBoundary>
        )}
        
        {/* Section 2: Model toggles */}
        {!isOllamaProvider && (
          <>
            <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-700 pl-2">
              <ErrorBoundary componentName="SpecializedModelsCtrl">
                <SpecializedModelsCtrl ctx={ctx} chat={activeChat} />
              </ErrorBoundary>
            </div>
            <div className="border-l border-gray-300 dark:border-gray-700 h-6"></div>
          </>
        )}
        
        {/* Section 4: Tools, Prompts and Knowledge */}
        <ErrorBoundary componentName="ToolCtrl">
          <ToolCtrl ctx={ctx} chat={activeChat} />
        </ErrorBoundary>
        <ErrorBoundary componentName="PromptCtrl">
          <PromptCtrl ctx={ctx} chat={activeChat} />
        </ErrorBoundary>
        <ErrorBoundary componentName="KnowledgeCtrl">
          <KnowledgeCtrl ctx={ctx} chat={activeChat} />
        </ErrorBoundary>
        
        <div className="border-l border-gray-300 dark:border-gray-700 h-6"></div>
        
        {/* Section 5: Model parameters */}
        {hasParams && (
          <div className="flex items-center">
            <Popover
              open={parametersPopupOpen}
              onOpenChange={(e, data) => setParametersPopupOpen(data.open)}
            >
              <PopoverTrigger>
                <Tooltip content="Model Parameters" relationship="description" positioning="above">
                  <Button size="small" appearance="subtle" className="p-1 mr-1 parameters-trigger" icon={<BrainCircuit20Regular />} onClick={toggleParametersPopup} />
                </Tooltip>
              </PopoverTrigger>
              <PopoverSurface className="parameters-popup">
                <div className="popup-title">Model Parameters</div>
                <div className="parameters-popup-container">
                  <MaxTokensCtrl ctx={ctx} chat={activeChat} onConfirm={onConfirm} />
                  <TemperatureCtrl ctx={ctx} chat={activeChat} />
                  <CtxNumCtrl ctx={ctx} chat={activeChat} />
                  {provider.chat.options.streamCustomizable && (
                    <StreamCtrl ctx={ctx} chat={activeChat} />
                  )}
                </div>
              </PopoverSurface>
            </Popover>
          </div>
        )}
      </Toolbar>
    );
  // Add dependencies for useCallback
  }, [
    toolbarRef, ctx, activeChat, isOllamaProvider, parametersPopupOpen, 
    setParametersPopupOpen, onConfirm, provider, t, toggleParametersPopup
  ]);

  return (
    <div className="py-1.5 bg-brand-surface-1 relative toolbar-wrapper">
      {renderToolbar()}
      <style>
        {`
          .toolbar-wrapper {
            position: relative;
            z-index: 10;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            width: 100%;
            padding-left: 0;
            padding-right: 0;
          }
          
          .editor-toolbar {
            width: 100% !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          
          .parameters-popup-container {
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 200px;
          }
          
          .popup-title {
            font-weight: 600;
            font-size: 14px;
            color: var(--colorNeutralForeground1);
            padding: 8px 8px 4px 8px;
            border-bottom: 1px solid var(--colorNeutralStroke1);
            margin-bottom: 8px;
            text-align: center;
          }
        `}
      </style>
    </div>
  );
}
