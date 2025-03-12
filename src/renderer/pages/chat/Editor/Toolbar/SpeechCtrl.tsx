import React, { useState } from 'react';
import { IChat } from 'intellichat/types';
import { Tooltip } from '@fluentui/react-components';
import { useTranslation } from 'react-i18next';
import { IChatContext } from 'intellichat/types';
import SpeechButton from 'components/SpeechButton';
import useChatStore from 'stores/useChatStore';
import useAppearanceStore from 'stores/useAppearanceStore';

interface SpeechCtrlProps {
  ctx: IChatContext;
  chat: IChat;
}

export default function SpeechCtrl({ ctx, chat }: SpeechCtrlProps) {
  const { t } = useTranslation();
  const editStage = useChatStore((state) => state.editStage);
  const [isRecording, setIsRecording] = useState(false);
  const theme = useAppearanceStore((state) => state.theme);
  
  // Handler for when speech-to-text returns text
  const handleTextReceived = (text: string) => {
    if (!text) return;
    
    // Get the current editor element
    const editorElement = document.getElementById('editor');
    if (!editorElement) return;
    
    // Append the transcribed text to the editor
    const currentContent = editorElement.innerHTML || '';
    const newContent = currentContent 
      ? `${currentContent}${currentContent.endsWith('\n') ? '' : '\n'}${text}` 
      : text;
    
    // Update the editor content
    editorElement.innerHTML = newContent;
    
    // Save the new content to the chat state
    editStage(chat.id, { input: newContent });
    
    // Set focus back to the editor
    editorElement.focus();
    
    // Move cursor to the end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(editorElement);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  
  // Handle recording state change
  const handleRecordingStateChange = (recording: boolean) => {
    setIsRecording(recording);
    
    // Add visual indication to the editor
    const editorElement = document.getElementById('editor');
    if (editorElement) {
      if (recording) {
        // Add recording class to editor
        editorElement.classList.add('recording-active');
      } else {
        // Remove recording class from editor
        editorElement.classList.remove('recording-active');
      }
    }
  };
  
  // Check if current provider is Ollama/OMNI Edge
  const provider = ctx.getProvider();
  const isOllamaProvider = provider.name === 'Ollama';
  
  // Disable speech for Ollama/OMNI Edge as it doesn't support the speech-to-text API
  const isDisabled = isOllamaProvider;
  
  return (
    <>
      <Tooltip
        content={isDisabled ? t('Common.SpeechNotSupported') : t('Common.SpeechToText')}
        relationship="label"
      >
        <div className="flex items-center">
          <SpeechButton 
            onTextReceived={handleTextReceived}
            onRecordingStateChange={handleRecordingStateChange}
            disabled={isDisabled}
            className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}
            appTheme={theme}
          />
        </div>
      </Tooltip>
      
      {/* Add global styles for recording state */}
      <style>
        {`
          #editor.recording-active {
            background-color: rgba(239, 68, 68, 0.05);
            transition: background-color 0.3s ease;
          }
        `}
      </style>
    </>
  );
} 