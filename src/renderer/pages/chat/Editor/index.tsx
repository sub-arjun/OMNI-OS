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
import { Button, Tooltip } from '@fluentui/react-components';
import { Send16Filled, Wand24Regular, Sparkle24Regular, DismissRegular } from '@fluentui/react-icons';
import Toolbar from './Toolbar';
import Spinner from '../../../components/Spinner';
import { removeTagsExceptImg, setCursorToEnd, blobToBase64, enhanceUserPrompt } from 'utils/util';
import { debounce } from 'lodash';
import { tempChatId } from 'consts';
import useAppearanceStore from 'stores/useAppearanceStore';
import ImgCtrl from './Toolbar/ImgCtrl';
import SpeechCtrl from './Toolbar/SpeechCtrl';
import PdfCtrl from './Toolbar/PdfCtrl';
import ErrorBoundary from 'renderer/components/ErrorBoundary';
import useChatContext from 'hooks/useChatContext';
import { Dismiss16Regular } from '@fluentui/react-icons';
import useToast from 'hooks/useToast';

// Define a type for the PDF data
export interface PdfAttachment {
  filename: string;
  dataUrl: string; // data:application/pdf;base64,...
}

export default function Editor({
  onSubmit,
  onAbort,
}: {
  // Update onSubmit signature to accept optional PDF
  onSubmit: (prompt: string, pdf?: PdfAttachment) => Promise<void> | undefined;
  onAbort: () => void;
}) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const controlsStyleRef = useRef<HTMLStyleElement | null>(null);
  const chat = useChatStore((state) => state.chat);
  const states = useChatStore().getCurState();
  const [submitted, setSubmitted] = useState<boolean>(false);
  const updateStates = useChatStore((state) => state.updateStates);
  const editStage = useChatStore((state) => state.editStage);
  const [savedRange, setSavedRange] = useState<Range | null>(null);
  const [showPlaceholder, setShowPlaceholder] = useState<boolean>(true);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const { notifyError } = useToast();
  
  // Get chat context for image control
  const ctx = useChatContext();
  const activeChat = ctx.getActiveChat();
  const model = ctx.getModel();
  const hasVisionSupport = model?.vision?.enabled || false;
  
  // Memoize the theme selector to ensure it doesn't change identity between renders
  const theme = useMemo(() => {
    return useAppearanceStore.getState()?.theme || 'light';
  }, []);
  
  // Define all useCallbacks before any useEffects to maintain consistent hook order
  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedRange(sel.getRangeAt(0));
    } else {
      setSavedRange(null);
    }
  }, []);

  const restoreRange = useCallback(() => {
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
  }, [editStage, submitted]);

  const onBlur = useCallback(() => {
    saveRange();
    // Show placeholder if editor is empty
    if (editorRef.current && !editorRef.current.textContent?.trim()) {
      setShowPlaceholder(true);
    }
  }, [saveRange]);

  const onFocus = useCallback(() => {
    restoreRange();
    // Hide placeholder when focused
    setShowPlaceholder(false);
  }, [restoreRange]);

  const insertText = useCallback((text: string) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
    selection.collapseToEnd();
    // Hide placeholder when text is inserted
    setShowPlaceholder(false);
  }, []);

  const pasteWithoutStyle = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    if (!e.clipboardData) return;
    const toolbarContainer = document.querySelector('.toolbar-container');
    if (toolbarContainer) {
      (toolbarContainer as HTMLElement).style.visibility = 'visible';
    }
    
    // Hide placeholder when pasting content
    setShowPlaceholder(false);
    
    // @ts-expect-error clipboardData is not defined in types
    const clipboardItems = e.clipboardData.items || window.clipboardData;
    let text = '';
    for (const item of clipboardItems) {
      if (item.kind === 'string' && item.type === 'text/plain') {
        item.getAsString(function (clipText) {
          let _text = clipText.replace(/&[a-z]+;/gi, ' ');
          _text = _text.replace(/<\/(p|div|br|h[1-6])>/gi, '\n');
          _text = _text.replace(/(<([^>]+)>)/gi, '');
          _text = _text.replace(/\n+/g, '\n\n').trim();
          text += _text;
          insertText(text);
        });
      } else if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = function (event) {
          const img = document.createElement('img');
          img.src = event.target?.result as string;
          if (editorRef.current) {
            editorRef.current.appendChild(img);
          }
        };
        if (file) {
          reader.readAsDataURL(file);
        }
      }
    }
  }, [insertText]);

  const onInput = useCallback(() => {
    if (chat && chat.id) {
      saveInput(chat.id);
      setSubmitted(false);
    }
    
    // Hide placeholder if there's content, show if empty
    if (editorRef.current) {
      setShowPlaceholder(!editorRef.current.textContent?.trim());
    }
  }, [chat, saveInput]);

  const onAbortClick = useCallback(() => {
    onAbort();
    if (chat && chat.id) {
      updateStates(chat.id, { loading: false });
    }
  }, [onAbort, updateStates, chat]);

  const onToolbarActionConfirm = useCallback(() => {
    setTimeout(() => {
      if (editorRef.current) {
        setCursorToEnd(editorRef.current);
      }
    }, 0);
    // Hide placeholder when toolbar action is confirmed
    setShowPlaceholder(false);
  }, []);
  
  // Define handleSubmit before onKeyDown and handleEnhanceClick
  const handleSubmit = useCallback(async () => {
    const prompt = removeTagsExceptImg(editorRef.current?.innerHTML || '');
    
    // Check if there is content or a PDF to send
    if (prompt.trim() || selectedPdf) {
      setSubmitted(true);
      let pdfAttachment: PdfAttachment | undefined = undefined;

      // If a PDF is selected, encode it
      if (selectedPdf) {
        try {
          const base64String = await blobToBase64(selectedPdf);
          // Create the data URL format required by OpenRouter
          const dataUrl = `data:application/pdf;base64,${base64String.split(',')[1] || base64String}`;
          pdfAttachment = {
            filename: selectedPdf.name,
            dataUrl: dataUrl,
          };
        } catch (error) {
          console.error("Error encoding PDF:", error);
          // Handle error appropriately, maybe show an alert
          alert('Failed to process PDF file.');
          setSubmitted(false); // Allow user to try again
          return;
        }
      }

      // Call onSubmit with prompt and optional PDF data
      onSubmit(prompt, pdfAttachment);

      // Clear editor and PDF state only after successful submission logic starts in parent
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      editStage(chat.id, { input: '' });
      setSelectedPdf(null); // Reset PDF state
      setShowPlaceholder(true);
    }
  }, [onSubmit, editStage, chat.id, selectedPdf]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        handleSubmit(); 
      }
    },
    [handleSubmit, editStage, chat.id],
  );
  
  // Click handler for the enhance button
  const handleEnhanceClick = useCallback(async () => {
    if (!editorRef.current || isEnhancing) {
      return;
    }
    const originalPrompt = editorRef.current.innerHTML;
    if (!originalPrompt || !originalPrompt.trim()) {
      notifyError('Cannot enhance an empty prompt.');
      return;
    }

    setIsEnhancing(true);
    try {
      const enhancedPrompt = await enhanceUserPrompt(originalPrompt);
      
      if (enhancedPrompt !== originalPrompt) {
        // Update the chat store state - this should trigger the useEffect sync
        editStage(chat.id, { input: enhancedPrompt }); 
      } else {
        console.log("Prompt enhancement didn't result in changes.");
      }
    } catch (error: any) {
      console.error('Error enhancing prompt:', error);
      notifyError(`Failed to enhance prompt: ${error.message || 'Unknown error'}`);
    } finally {
      setIsEnhancing(false);
    }
  }, [isEnhancing, chat.id, editStage, notifyError]);
  
  // Update styles based on theme - moved here for consistent ordering
  const updateStyles = useCallback(() => {
    const currentTheme = useAppearanceStore.getState()?.theme || 'light';
    
    if (!styleRef.current) {
      styleRef.current = document.createElement('style');
      document.head.appendChild(styleRef.current);
    }
    
    styleRef.current.innerHTML = getEditorStyles(currentTheme as 'light' | 'dark');
  }, []);
  
  // Helper function to generate editor styles
  const getEditorStyles = (currentTheme: 'light' | 'dark') => {
    return `
      .chat-input-container {
        position: relative;
        border-radius: 10px;
        background-color: transparent;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
        border: 1px solid ${currentTheme === 'dark' ? 'rgba(74, 85, 104, 0.5)' : 'rgba(203, 213, 224, 0.9)'};
        /* Make transition more specific */
        transition: 
          border-color 0.3s cubic-bezier(0.25, 1, 0.5, 1),
          box-shadow 0.3s cubic-bezier(0.25, 1, 0.5, 1),
          background-color 0.3s cubic-bezier(0.25, 1, 0.5, 1),
          height 0.15s ease;
        overflow: hidden;
        transform: translateZ(0);
        margin: 0 16px 10px 16px;
        display: flex;
        flex-direction: column;
        min-height: 140px;
        flex: 1;
        height: auto;
        padding: 0 0 4px 0;
        max-height: calc(90vh - 140px);
        bottom: 0;
        isolation: isolate;
      }
      
      .chat-input-container.recording-active {
        background-color: transparent !important;
        backdrop-filter: none;
        overflow: hidden;
      }
      
      .chat-input-container:focus-within {
        border: 1px solid ${currentTheme === 'dark' ? 'rgba(66, 153, 225, 0.8)' : 'rgba(66, 153, 225, 0.6)'};
        box-shadow: 0 0 0 2px ${currentTheme === 'dark' ? 'rgba(66, 153, 225, 0.25)' : 'rgba(66, 153, 225, 0.25)'}, 0 2px 6px rgba(0, 0, 0, 0.1);
        background-color: transparent;
      }
      
      .input-row {
        display: flex;
        align-items: stretch;
        width: 100%;
        min-height: 120px;
        position: relative;
        flex: 1;
        border-bottom: none;
        padding: 0;
        overflow: hidden;
        height: auto;
        max-height: calc(100% - 4px);
        border-radius: 9px;
      }
      
      .placeholder-text {
        position: absolute;
        top: 14px;
        left: 60px;
        transform: none;
        color: ${currentTheme === 'dark' ? 'rgba(160, 174, 192, 0.7)' : 'rgba(113, 128, 150, 0.7)'} !important;
        font-size: 16px;
        font-weight: 400;
        pointer-events: none;
        z-index: 1;
        transition: all 0.2s ease;
        letter-spacing: 0.01em;
      }
      
      .chat-input-container:focus-within .placeholder-text {
        color: ${currentTheme === 'dark' ? 'rgba(160, 174, 192, 0.45)' : 'rgba(113, 128, 150, 0.45)'} !important;
        transform: translateX(3px);
        opacity: 0.8;
      }
      
      #editor {
        position: relative;
        z-index: 2;
        background-color: transparent;
        color: ${currentTheme === 'dark' ? 'rgba(237, 242, 247, 1)' : 'rgba(45, 55, 72, 1)'};
        font-size: 16px;
        line-height: 1.6;
        padding: 12px 12px;
        padding-right: 96px;
        padding-bottom: 12px;
        font-weight: 400;
        flex: 1;
        outline: none !important;
        transition: all 0.2s ease;
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;
        min-height: 120px;
        height: auto;
        max-height: calc(90vh - 180px);
        border-radius: inherit;
        backdrop-filter: none;
        display: flex;
        flex-direction: column;
      }
      
      #editor::selection {
        background-color: ${currentTheme === 'dark' ? 'rgba(99, 179, 237, 0.3)' : 'rgba(66, 153, 225, 0.15)'};
      }
      
      #editor.recording-active {
        background-color: transparent !important;
        backdrop-filter: none !important;
      }
      
      .recording-overlay {
        pointer-events: auto;
        min-height: 80px;
      }
      
      .recording-stop-button {
        pointer-events: auto;
        cursor: pointer;
      }
      
      .visual-separator {
        display: none;
      }
      
      .send-button {
        position: absolute;
        top: 14px;
        right: 24px;
        margin-right: 0;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: ${currentTheme === 'dark' 
          ? 'rgba(99, 179, 237, 0.15)'
          : 'rgba(66, 153, 225, 0.12)'
        };
        color: ${currentTheme === 'dark' ? 'rgba(179, 205, 237, 0.95)' : 'rgba(49, 130, 206, 0.95)'};
        cursor: pointer;
        transition: all 0.2s ease;
        opacity: 1;
        padding: 0 14px;
        font-size: 14px;
        font-weight: 600;
        border: 1px solid ${currentTheme === 'dark' ? 'rgba(99, 179, 237, 0.3)' : 'rgba(66, 153, 225, 0.25)'};
        box-shadow: 0 1px 3px rgba(0, 0, 0, ${currentTheme === 'dark' ? '0.15' : '0.05'});
        z-index: 3;
      }
      
      .chat-input-container:focus-within .send-button {
        color: ${currentTheme === 'dark' ? 'rgba(206, 225, 249, 1)' : 'rgba(44, 122, 197, 1)'};
        border-color: ${currentTheme === 'dark' ? 'rgba(109, 189, 247, 0.5)' : 'rgba(66, 153, 225, 0.4)'};
        background-color: ${currentTheme === 'dark' 
          ? 'rgba(99, 179, 237, 0.2)'
          : 'rgba(66, 153, 225, 0.15)'
        };
      }
      
      .send-button:hover {
        background-color: ${currentTheme === 'dark' ? 'rgba(99, 179, 237, 0.25)' : 'rgba(66, 153, 225, 0.2)'};
        color: ${currentTheme === 'dark' ? '#ffffff' : '#2b6cb0'};
        border-color: ${currentTheme === 'dark' ? 'rgba(109, 189, 247, 0.7)' : 'rgba(66, 153, 225, 0.5)'};
        box-shadow: 0 2px 5px rgba(0, 0, 0, ${currentTheme === 'dark' ? '0.2' : '0.08'});
      }
      
      .send-button:active {
        transform: translateY(1px);
        box-shadow: 0 1px 2px rgba(0, 0, 0, ${currentTheme === 'dark' ? '0.15' : '0.05'});
      }
      
      .toolbar-container {
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 10;
        margin-bottom: 8px;
        margin-top: 0;
        padding: 0;
        width: 100%;
        margin-left: 0;
        margin-right: 0;
        transition: opacity 0.3s ease;
      }
      
      .editor-loading-mask {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 50;
        background-color: ${currentTheme === 'dark' ? 'rgba(26, 32, 44, 0.6)' : 'rgba(255, 255, 255, 0.7)'}; /* Slightly darker backdrop */
        display: flex; /* Use flex to center content */
        justify-content: center;
        align-items: center;
        /* Apply animation directly to the mask */
        animation: popUp 0.25s ease-out forwards;
        transform-origin: center; 
        opacity: 0; /* Initial state for animation */
        transform: scale(0.9); /* Initial state for animation */
        padding: 0; /* Remove previous padding */
        box-sizing: border-box;
      }
      
      @keyframes popUp {
        from { 
          opacity: 0; 
          /* Only animate scale and opacity, flexbox handles position */
          transform: scale(0.9);
        }
        to { 
          opacity: 1; 
          transform: scale(1);
        }
      }
      
      /* Remove styles from the temporary wrapper */
      .editor-loading-mask .popup-content {
         all: unset; /* Reset all styles */
         display: block; /* Or whatever display it needs */
      }
      
      .editor-loading-mask button {
        /* Remove animation-related styles from button */
        /* animation: popUp 0.25s ease-out forwards; */
        /* transform-origin: center; */
        /* opacity: 0; */
        /* transform: scale(0.85) translateY(10px); */
        
        /* Keep visual styles */
        background-color: ${currentTheme === 'dark' ? 'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.95)'}; /* Make slightly more opaque */
        border: 1px solid ${currentTheme === 'dark' ? 'rgba(74, 85, 104, 0.7)' : 'rgba(203, 213, 224, 1)'};
        box-shadow: 0 3px 12px rgba(0, 0, 0, ${currentTheme === 'dark' ? '0.3' : '0.1'}); /* Slightly stronger shadow */
        border-radius: 8px;
        padding: 8px 16px;
        opacity: 1; /* Ensure button is visible if mask fades in */
        transform: none; /* Ensure no stray transforms */
      }
      
      .editor {
        position: relative;
        margin-bottom: 0;
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        width: 100%;
        padding: 0;
        margin-left: 0;
        margin-right: 0;
      }
      
      .editor.is-loading #editor,
      .editor.is-loading .toolbar-container {
        filter: blur(2px);
        transition: filter 0.2s ease-in-out;
        /* Optional: Prevent interaction with blurred elements */
        pointer-events: none; 
        user-select: none; 
      }
      
      /* Ensure mask and button are NOT blurred and ARE interactive */
      .editor.is-loading .editor-loading-mask {
        filter: none;
        pointer-events: auto;
        user-select: auto;
      }
      .editor.is-loading .editor-loading-mask button {
         pointer-events: auto; 
         user-select: auto; 
      }

      /* Add processing icon animation */
      @keyframes processing-icon-spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
      .processing-icon {
        /* Apply animation */
        animation: processing-icon-spin 1s linear infinite;
        /* Ensure consistent sizing if needed */
        width: 16px; 
        height: 16px;
        /* Add color - inheriting might be best */
        /* color: ${currentTheme === 'dark' ? 'rgba(99, 179, 237, 0.9)' : 'rgba(44, 122, 197, 1)'}; */
      }
    `;
  };
  
  // Watch for theme changes
  useEffect(() => {
    // Create closure for updateStyles to avoid stale references
    const handleThemeChange = () => {
      updateStyles();
    };
    
    // Set up subscription
    const unsubscribe = useAppearanceStore.subscribe(handleThemeChange);
    
    // Initial style application
    updateStyles();
    
    // Clean up
    return () => {
      unsubscribe();
    };
  }, [updateStyles]);
  
  // Setup input controls styles
  useEffect(() => {
    // Create input controls style element
    if (!controlsStyleRef.current) {
      controlsStyleRef.current = document.createElement('style');
      controlsStyleRef.current.id = 'input-controls-alignment';
      document.head.appendChild(controlsStyleRef.current);
    }
    
    // Custom style string that uses translation as part of the selector
    const imageSelector = t('Common.Image');
    
    // Update styles
    if (controlsStyleRef.current) {
      controlsStyleRef.current.innerHTML = `
        .input-controls-container {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 52px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 14px;
          z-index: 5;
          background: transparent;
          gap: 8px; /* Add gap for consistent spacing */
        }

        .input-controls-container button {
          height: 32px !important;
          width: 32px !important;
          min-width: 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          margin: 0 !important; /* Remove specific margins */
        }
        
        /* Adjust SpeechCtrl positioning */
        .input-controls-container .speech-button-container {
          margin-top: -2px !important; /* Add small negative top margin to move up */
          margin-left: -5px !important; /* Increase negative left margin further */
          position: relative !important;
          overflow: visible !important;
        }
        
        /* Ensure PdfCtrl doesn't have extra top margin (handled by gap) */
        .input-controls-container > div[componentName="PdfCtrl"] button {
          margin-top: 0 !important; 
        }

        /* Make the image control icon match speech control size */
        .input-controls-container [aria-label="${imageSelector}"] {
          width: 32px !important;
          min-width: 32px !important;
          padding: 0 !important;
        }
        
        /* Make the speech chevron match image control style */
        .speech-button-chevron {
          background-color: transparent !important;
        }
        
        /* Make chevron icon bigger */
        .speech-button-chevron svg {
          width: 10px !important;
          height: 10px !important;
        }

        /* Adjust the editor with proper left padding for controls */
        #editor {
          padding-left: 88px !important;
        }

        /* Adjust placeholder text */
        .placeholder-text {
          left: 94px !important;
        }

        /* Keyframes for control entrance */
        @keyframes controlFadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Class to apply the animation */
        .control-enter-animation {
          animation: controlFadeInUp 0.4s ease-out forwards;
        }
      `;
    }
    
    // Clean up on unmount
    return () => {
      if (controlsStyleRef.current) {
        document.head.removeChild(controlsStyleRef.current);
        controlsStyleRef.current = null;
      }
    };
  }, [t]);
  
  // Clean up styles on unmount
  useEffect(() => {
    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, []);
  
  // Event handler for custom editorContentChanged event (for speech input)
  const handleEditorContentChanged = useCallback((event: CustomEvent) => {
    if (event.detail?.hasContent) {
      setShowPlaceholder(false);
    } else {
      setShowPlaceholder(!editorRef.current?.textContent?.trim());
    }
  }, []);
  
  // Callback for PdfCtrl to update the selected file
  const handlePdfSelect = useCallback((file: File) => {
    setSelectedPdf(file);
    // Hide placeholder when PDF is selected
    setShowPlaceholder(false);
  }, []);
  
  // Callback to clear the selected PDF
  const clearSelectedPdf = useCallback(() => {
    setSelectedPdf(null);
    // Show placeholder again if editor is also empty
    if (editorRef.current && !editorRef.current.textContent?.trim()) {
      setShowPlaceholder(true);
    }
  }, []);
  
  // Main effect for setup
  useEffect(() => {
    setSubmitted(false);
    
    if (editorRef.current) {
      editorRef.current.addEventListener('paste', pasteWithoutStyle);
      
      // Add listener for custom editorContentChanged event (for speech input)
      editorRef.current.addEventListener('editorContentChanged', handleEditorContentChanged as EventListener);
      
      if (chat && chat.id) {
        // Check if any input element, textarea, or contentEditable element already has focus
        // before automatically focusing the editor
        const activeElement = document.activeElement;
        const isInputActive = activeElement instanceof HTMLInputElement || 
                             activeElement instanceof HTMLTextAreaElement || 
                             activeElement?.getAttribute('contenteditable') === 'true' ||
                             activeElement?.classList.contains('fui-Textarea') ||
                             document.querySelector('.chat-settings-drawer:focus-within');
        
        if (!isInputActive) {
        editorRef.current.focus();
        }
        const content = chat.input || '';
        if (content !== editorRef.current.innerHTML) {
          editorRef.current.innerHTML = content;
          setCursorToEnd(editorRef.current);
          // Update placeholder state based on content
          setShowPlaceholder(!content);
          
          // Adjust height based on content after setting it - REMOVE THIS CALL
          // setTimeout(adjustEditorHeight, 0);
        }
      }
    }
    
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener('paste', pasteWithoutStyle);
        editorRef.current.removeEventListener('editorContentChanged', handleEditorContentChanged as EventListener);
      }
    };
  }, [chat, pasteWithoutStyle, handleEditorContentChanged]);

  return (
    <div 
      className={`relative flex flex-col editor ${states.loading ? 'is-loading' : ''}`}
      style={{ 
        flex: '1', 
        display: 'flex',
        paddingBottom: '8px',
        position: 'relative',
        maxHeight: '80vh',
        height: '100%'
      }}
    >
      <div className="toolbar-container" style={{ width: '100%', maxWidth: '100%' }}>
        <Toolbar 
          onConfirm={onToolbarActionConfirm} 
        />
      </div>
      
      <div 
        className="chat-input-container" 
        style={{ 
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Controls container stacked vertically */}
        <div className="input-controls-container" style={{ 
          position: 'absolute', 
          top: '0',
          left: '0',
          bottom: '0',
          width: '52px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '14px 0',
          zIndex: 5
        }}>
          {/* Swapped Order: PDF -> Speech -> Image */}
          <ErrorBoundary componentName="PdfCtrl" className="control-enter-animation">
            <PdfCtrl 
              onFileSelect={handlePdfSelect} 
              selectedPdfName={selectedPdf ? selectedPdf.name : null}
              onClearPdf={clearSelectedPdf}
            />
          </ErrorBoundary>

          <ErrorBoundary componentName="SpeechCtrl" className="control-enter-animation">
            <SpeechCtrl ctx={ctx} chat={activeChat} />
          </ErrorBoundary>

          {hasVisionSupport && (
            <ErrorBoundary componentName="ImgCtrl" className="control-enter-animation">
              <ImgCtrl ctx={ctx} chat={activeChat} />
            </ErrorBoundary>
          )}
        </div>
        
        <div 
          className="input-row"
          style={{
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {showPlaceholder && (
            <div className="placeholder-text" style={{ left: '94px' }}>
              Ask OMNI to do anything...
            </div>
          )}
          <div
            contentEditable={true}
            suppressContentEditableWarning={true}
            id="editor"
            ref={editorRef}
            className="outline-0"
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            onInput={onInput}
            style={{ 
              whiteSpace: 'pre-wrap',
              transition: 'all 0.3s ease',
              overflowY: 'auto',
              overflowX: 'hidden',
              height: 'auto',
              minHeight: '48px',
              paddingBottom: '16px',
              position: 'relative',
              backgroundColor: 'transparent',
              paddingLeft: '88px',
              paddingRight: '96px'
            }}
          />
          
          {/* Container for Send and Enhance buttons */}
          <div style={{ position: 'absolute', top: '14px', right: '24px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
            {/* Enhance Prompt Button */} 
            <Tooltip content={t('Enhance Prompt')} relationship="label" positioning="above">
              <Button
                appearance="subtle"
                size="medium"
                icon={isEnhancing ? <DismissRegular className="processing-icon" /> : <Sparkle24Regular />}
                onClick={handleEnhanceClick}
                disabled={isEnhancing || states.loading} 
                style={{ 
                  minWidth: '32px',
                  height: '32px',
                  width: '32px',
                  padding: 0
                }}
                title={t('Enhance Prompt')}
              />
            </Tooltip>
            
            {/* Send Button */}
            <div className="send-button" onClick={handleSubmit} style={{ position: 'relative', top: 'auto', right: 'auto' }}>
              Send
            </div>
          </div>
        </div>

        {states.loading && (
          <div className="editor-loading-mask absolute flex justify-center items-center">
            <Button onClick={onAbortClick} className="flex items-center">
              <Spinner size={18} className="mr-2" />
              {t('Common.StopGenerating')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
