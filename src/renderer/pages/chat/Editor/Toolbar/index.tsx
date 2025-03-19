import { Toolbar } from '@fluentui/react-components';
import { useState, useEffect, useRef } from 'react';
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
import { Button, Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components';
import { ChevronUp16Regular, Settings16Regular } from '@fluentui/react-icons';
import SpecializedModelsCtrl from './SpecializedModelsCtrl';
import ErrorBoundary from 'renderer/components/ErrorBoundary';

export default function EditorToolbar({
  onConfirm,
}: {
  onConfirm: () => void;
}) {
  const ctx = useChatContext();
  const provider = ctx.getProvider();
  const chat = ctx.getActiveChat();
  const model = ctx.getModel();
  const hasVisionSupport = model?.vision?.enabled || false;
  
  // Check if current provider is Ollama/OMNI Edge
  const isOllamaProvider = provider.name === 'Ollama';
  
  // State for responsive collapsing
  const [isParametersCollapsed, setIsParametersCollapsed] = useState(false);
  const [parametersPopupOpen, setParametersPopupOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  // Check available space for parameters section
  useEffect(() => {
    const checkSpace = () => {
      const toolbar = document.querySelector('.editor-toolbar');
      const availableWidth = toolbar?.clientWidth || window.innerWidth;
      
      // If width is below threshold, collapse parameters
      setIsParametersCollapsed(availableWidth < 1000);
    };
    
    // Set up ResizeObserver
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
    setTimeout(checkSpace, 100);
    setTimeout(checkSpace, 500);
    
    return () => {
      window.removeEventListener('resize', checkSpace);
      resizeObserver.disconnect();
    };
  }, []);
  
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

  return (
    <div className="py-1.5 bg-brand-surface-1 relative toolbar-wrapper">
      <Toolbar
        ref={toolbarRef}
        aria-label="Default"
        size="small"
        className="flex items-center gap-3 ml-2 editor-toolbar"
      >
        {/* Section 1: Model selector with error boundary */}
        <ErrorBoundary
          componentName="ModelCtrl"
          fallback={
            <div className="flex items-center px-2 py-1 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded">
              Model selector unavailable
            </div>
          }
        >
          <ModelCtrl ctx={ctx} chat={chat} />
        </ErrorBoundary>
        
        {/* Section 2: Model toggles (Deep Search, etc.) */}
        {!isOllamaProvider && (
          <>
            <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-700 pl-2">
              <ErrorBoundary componentName="SpecializedModelsCtrl">
                <SpecializedModelsCtrl ctx={ctx} chat={chat} />
              </ErrorBoundary>
            </div>
            <div className="border-l border-gray-300 dark:border-gray-700 h-6"></div>
          </>
        )}
        
        {/* Section 3: Speech and Image controls (moved before prompts) */}
        <div className="flex items-center gap-2">
          <ErrorBoundary componentName="SpeechCtrl">
            <SpeechCtrl ctx={ctx} chat={chat} />
          </ErrorBoundary>
          {hasVisionSupport && (
            <ErrorBoundary componentName="ImgCtrl">
              <ImgCtrl ctx={ctx} chat={chat} />
            </ErrorBoundary>
          )}
        </div>
        
        {/* Divider after speech and image controls */}
        <div className="border-l border-gray-300 dark:border-gray-700 h-6"></div>
        
        {/* Section 4: Prompts and Knowledge */}
        <ErrorBoundary componentName="PromptCtrl">
          <PromptCtrl ctx={ctx} chat={chat} />
        </ErrorBoundary>
        <ErrorBoundary componentName="KnowledgeCtrl">
          <KnowledgeCtrl ctx={ctx} chat={chat} />
        </ErrorBoundary>
        
        {/* Divider between sections */}
        <div className="border-l border-gray-300 dark:border-gray-700 h-6"></div>
        
        {/* Section 5: Model parameters - collapsible */}
        {isParametersCollapsed ? (
          <div className="flex items-center">
            <Popover
              open={parametersPopupOpen}
              onOpenChange={(e, data) => setParametersPopupOpen(data.open)}
            >
              <PopoverTrigger>
                <Button
                  size="small"
                  appearance="subtle"
                  className="p-1 mr-1 parameters-trigger"
                  icon={<Settings16Regular />}
                  onClick={toggleParametersPopup}
                />
              </PopoverTrigger>
              <PopoverSurface className="parameters-popup">
                <div className="popup-title">Model Parameters</div>
                <div className="parameters-popup-container">
                  <MaxTokensCtrl ctx={ctx} chat={chat} onConfirm={onConfirm} />
                  <TemperatureCtrl ctx={ctx} chat={chat} />
                  <CtxNumCtrl ctx={ctx} chat={chat} />
                  {provider.chat.options.streamCustomizable && (
                    <StreamCtrl ctx={ctx} chat={chat} />
                  )}
                </div>
              </PopoverSurface>
            </Popover>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MaxTokensCtrl ctx={ctx} chat={chat} onConfirm={onConfirm} />
            <TemperatureCtrl ctx={ctx} chat={chat} />
            <CtxNumCtrl ctx={ctx} chat={chat} />
            {provider.chat.options.streamCustomizable && (
              <StreamCtrl ctx={ctx} chat={chat} />
            )}
          </div>
        )}
      </Toolbar>
      
      <style>
        {`
          .toolbar-wrapper {
            position: relative;
            z-index: 10;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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
