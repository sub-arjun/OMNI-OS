import {
  KeyboardEvent,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import useChatStore from 'stores/useChatStore';
import { useTranslation } from 'react-i18next';
import { Button } from '@fluentui/react-components';
import Toolbar from './Toolbar';
import Spinner from '../../../components/Spinner';
import { removeTagsExceptImg, setCursorToEnd } from 'utils/util';
import { debounce } from 'lodash';
import { tempChatId } from 'consts';

export default function Editor({
  onSubmit,
  onAbort,
}: {
  onSubmit: (prompt: string) => Promise<void> | undefined;
  onAbort: () => void;
}) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const chat = useChatStore((state) => state.chat);
  const states = useChatStore().getCurState();
  const [submitted, setSubmitted] = useState<boolean>(false);
  const updateStates = useChatStore((state) => state.updateStates);
  const editStage = useChatStore((state) => state.editStage);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedRange(sel.getRangeAt(0));
    } else {
      setSavedRange(null);
    }
  }, [setSavedRange]);

  const restoreRange = useCallback(() => {
    // 恢复选区
    if (savedRange) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    }
  }, [savedRange]);

  const saveInput = useMemo(() => {
    return debounce((chatId: string) => {
      if (!submitted) {
        editStage(chatId, { input: editorRef.current?.innerHTML });
      }
    }, 500);
  }, [editStage]);

  const onBlur = () => {
    saveRange();
  };

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        setSubmitted(true);
        onSubmit(removeTagsExceptImg(editorRef.current?.innerHTML || ''));
        // @ts-ignore
        editorRef.current.innerHTML = '';
        editStage(chat.id, { input: '' });
      }
    },
    [onSubmit],
  );

  const insertText = useCallback((text: string) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    selection.deleteFromDocument(); // 删除选中的内容
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
    selection.collapseToEnd();
  }, []);

  const pasteWithoutStyle = useCallback((e: ClipboardEvent) => {
    e.preventDefault(); // 阻止默认粘贴行为
    if (!e.clipboardData) return;
    // Keep toolbar visible during paste
    const toolbarContainer = document.querySelector('.toolbar-container');
    if (toolbarContainer) {
      (toolbarContainer as HTMLElement).style.visibility = 'visible';
    }
    
    // @ts-expect-error clipboardData is not defined in types
    const clipboardItems = e.clipboardData.items || window.clipboardData;
    let text = '';
    // 遍历剪贴板中的项目
    for (const item of clipboardItems) {
      if (item.kind === 'string' && item.type === 'text/plain') {
        // 获取纯文本
        item.getAsString(function (clipText) {
          let _text = clipText.replace(/&[a-z]+;/gi, ' ');
          _text = _text.replace(/<\/(p|div|br|h[1-6])>/gi, '\n');
          _text = _text.replace(/(<([^>]+)>)/gi, '');
          _text = _text.replace(/\n+/g, '\n\n').trim();
          text += _text;
          insertText(text); // 插入文本
        });
      } else if (item.kind === 'file' && item.type.startsWith('image/')) {
        // 处理图片
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = function (event) {
          const img = document.createElement('img');
          img.src = event.target?.result as string; // 设置图片源
          editorRef.current && editorRef.current.appendChild(img); // 插入图片
        };
        reader.readAsDataURL(file as Blob); // 读取文件为数据URL
      }
    }
  }, []);

  const onInput = () => {
    saveInput(chat.id);
    setSubmitted(false);
  };

  useEffect(() => {
    setSubmitted(false);
    if (editorRef.current) {
      editorRef.current.addEventListener('paste', pasteWithoutStyle);
    }
    if (editorRef.current && chat.id) {
      editorRef.current.focus();
      const content = chat.input || '';
      if (content !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = content;
        setCursorToEnd(editorRef.current);
      }
    }
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('paste', pasteWithoutStyle);
      }
    };
  }, [chat.id]);

  const onAbortClick = () => {
    onAbort();
    updateStates(chat.id, { loading: false });
  };

  const onToolbarActionConfirm = () => {
    setTimeout(() => setCursorToEnd(editorRef.current as HTMLDivElement));
  };

  return (
    <div className="relative flex flex-col editor">
      {states.loading ? (
        <div className="editor-loading-mask absolute flex flex-col justify-center items-center">
          <Button onClick={onAbortClick} className="flex items-center">
            <Spinner size={18} className="mr-2" />
            {t('Common.StopGenerating')}
          </Button>
        </div>
      ) : null}
      <div className="toolbar-container">
        <Toolbar onConfirm={onToolbarActionConfirm} />
      </div>
      <div
        contentEditable={true}
        suppressContentEditableWarning={true}
        id="editor"
        ref={editorRef}
        className="w-full outline-0 pl-2.5 pr-2.5 pb-2.5 bg-brand-surface-1 flex-grow overflow-y-auto overflow-x-hidden relative"
        onKeyDown={onKeyDown}
        onFocus={restoreRange}
        onBlur={onBlur}
        onInput={onInput}
        style={{ 
          resize: 'none', 
          whiteSpace: 'pre-wrap',
          transition: 'all 0.3s ease' 
        }}
      />
      <div className="h-12 flex-shrink-0" />
      
      {/* Add global styles for recording state */}
      <style>
        {`
          /* Ensure toolbar always remains visible */
          .toolbar-container {
            visibility: visible !important;
            opacity: 1 !important;
            z-index: 10;
          }
          
          #editor.recording-active {
            background-color: rgba(239, 68, 68, 0.05);
            border: 1px solid rgba(239, 68, 68, 0.2);
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.1) inset;
          }
          
          .recording-overlay {
            /* Allow pointer events for the stop button */
            pointer-events: auto;
          }
          
          /* Button will use its own animation defined in SpeechButton.tsx */
          .recording-stop-button {
            pointer-events: auto;
            cursor: pointer;
          }
        `}
      </style>
    </div>
  );
}
