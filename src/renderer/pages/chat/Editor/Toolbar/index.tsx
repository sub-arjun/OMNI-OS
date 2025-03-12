import { Toolbar } from '@fluentui/react-components';
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

  return (
    <div className="py-1.5 bg-brand-surface-1 relative">
      <Toolbar
        aria-label="Default"
        size="small"
        className="flex items-center gap-3 ml-2 editor-toolbar"
      >
        {/* Section 1: Model selector */}
        <ModelCtrl ctx={ctx} chat={chat} />
        
        {/* Section 2: Model toggles (Deep Search, etc.) */}
        {!isOllamaProvider && (
          <>
            <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-700 pl-2">
              <DeepSearchCtrl ctx={ctx} chat={chat} />
              <DeepThoughtCtrl ctx={ctx} chat={chat} />
              <OmegaFlashCtrl ctx={ctx} chat={chat} />
            </div>
            <div className="border-l border-gray-300 dark:border-gray-700 h-6"></div>
          </>
        )}
        
        {/* Section 3: Speech and Image controls (moved before prompts) */}
        <div className="flex items-center gap-2">
          <SpeechCtrl ctx={ctx} chat={chat} />
          {hasVisionSupport && <ImgCtrl ctx={ctx} chat={chat} />}
        </div>
        
        {/* Divider after speech and image controls */}
        <div className="border-l border-gray-300 dark:border-gray-700 h-6"></div>
        
        {/* Section 4: Prompts and Knowledge */}
        <PromptCtrl ctx={ctx} chat={chat} />
        <KnowledgeCtrl ctx={ctx} chat={chat} />
        
        {/* Divider between sections */}
        <div className="border-l border-gray-300 dark:border-gray-700 h-6"></div>
        
        {/* Section 5: Model parameters */}
        <div className="flex items-center gap-2">
          <MaxTokensCtrl ctx={ctx} chat={chat} onConfirm={onConfirm} />
          <TemperatureCtrl ctx={ctx} chat={chat} />
          <CtxNumCtrl ctx={ctx} chat={chat} />
          {provider.chat.options.streamCustomizable && (
            <StreamCtrl ctx={ctx} chat={chat} />
          )}
        </div>
      </Toolbar>
    </div>
  );
}
