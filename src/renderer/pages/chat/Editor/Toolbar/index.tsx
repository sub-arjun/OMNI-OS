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
        <ModelCtrl ctx={ctx} chat={chat} />
        
        {/* Only show Deep Search, Deep Thought, and Flash buttons for non-Ollama providers */}
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
        
        <PromptCtrl ctx={ctx} chat={chat} />
        <KnowledgeCtrl ctx={ctx} chat={chat} />
        {hasVisionSupport && <ImgCtrl ctx={ctx} chat={chat} />}
        <MaxTokensCtrl ctx={ctx} chat={chat} onConfirm={onConfirm} />
        <TemperatureCtrl ctx={ctx} chat={chat} />
        <CtxNumCtrl ctx={ctx} chat={chat} />

        {provider.chat.options.streamCustomizable && (
          <StreamCtrl ctx={ctx} chat={chat} />
        )}
      </Toolbar>
    </div>
  );
}
