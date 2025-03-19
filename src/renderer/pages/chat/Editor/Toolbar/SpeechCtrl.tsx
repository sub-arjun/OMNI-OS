import React, { useState, useRef, useEffect } from 'react';
import { IChat } from 'intellichat/types';
import { Tooltip, Menu, MenuTrigger, MenuList, MenuItem, MenuPopover } from '@fluentui/react-components';
import { useTranslation } from 'react-i18next';
import { IChatContext } from 'intellichat/types';
import SpeechButton from 'components/SpeechButton';
import useChatStore from 'stores/useChatStore';
import useAppearanceStore from 'stores/useAppearanceStore';
import { ChevronDown16Regular, ArrowUpload16Regular } from '@fluentui/react-icons';
import { speechToText, blobToBase64 } from 'utils/util';

// Declare global types for window
declare global {
  interface Window {
    _activeSpeechProcessing?: boolean;
    _lastProcessingStartTime?: number;
  }
}

interface SpeechCtrlProps {
  ctx: IChatContext;
  chat: IChat;
}

export default function SpeechCtrl({ ctx, chat }: SpeechCtrlProps) {
  const { t } = useTranslation();
  const editStage = useChatStore((state) => state.editStage);
  const [isRecording, setIsRecording] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const theme = useAppearanceStore((state) => state.theme);
  const appTheme = theme === 'system' ? 'light' : theme as 'light' | 'dark';
  
  // Use a ref for the container div instead of the input directly
  const fileInputContainerRef = useRef<HTMLDivElement>(null);
  
  // Helper function to clean up audio processing overlay
  const cleanupAudioProcessingOverlay = () => {
    console.log('Executing audio processing overlay cleanup');
    
    // Remove processing overlay
    const overlay = document.getElementById('processing-audio-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      console.log('Successfully removed audio overlay');
    }
    
    // Remove processing class from all editors (not just the current one)
    const editorElements = document.querySelectorAll('.processing-audio, .recording-active');
    editorElements.forEach(editor => {
      editor.classList.remove('processing-audio');
      editor.classList.remove('recording-active');
    });
    
    // Clear the file input container
    if (fileInputContainerRef.current) {
      fileInputContainerRef.current.innerHTML = '';
    }
    
    // Reset processing state
    setIsProcessing(false);
    setIsRecording(false);
    
    // Reset global flags
    if (window._activeSpeechProcessing) {
      window._activeSpeechProcessing = false;
    }
  };
  
  // Register a global document click event handler to check for navigation
  useEffect(() => {
    // Global function to check for and clean up audio overlays
    const globalCleanupCheck = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Always check if we're still processing but the overlay isn't visible anymore
      // This handles navigations, tab changes, etc.
      if (window._activeSpeechProcessing) {
        const overlay = document.getElementById('processing-audio-overlay');
        if (!overlay || !document.body.contains(overlay)) {
          console.log('Processing active but overlay not found - cleaning up');
          cleanupAudioProcessingOverlay();
        }
      }
      
      // Check if clicking on navigation elements
      if (target && (
        target.tagName === 'A' || 
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('[role="tab"]') ||
        target.closest('.nav-item') ||
        target.closest('.sidebar-item') ||
        target.closest('[data-nav]')
      )) {
        console.log('Navigation element clicked - cleaning up audio processing');
        cleanupAudioProcessingOverlay();
      }
    };
    
    // Add global event listener
    document.addEventListener('click', globalCleanupCheck, true);
    document.addEventListener('mousedown', globalCleanupCheck, true);
    
    return () => {
      // Remove global event listener
      document.removeEventListener('click', globalCleanupCheck, true);
      document.removeEventListener('mousedown', globalCleanupCheck, true);
      
      // Always clean up when component unmounts
      cleanupAudioProcessingOverlay();
    };
  }, []);
  
  // Set up a global interval to check for stale processing
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Check for stale processing (more than 30s old)
      if (window._activeSpeechProcessing && window._lastProcessingStartTime) {
        const now = Date.now();
        const processingTime = now - window._lastProcessingStartTime;
        
        if (processingTime > 30000) {
          console.log('Found stale audio processing (over 30s) - cleaning up');
          cleanupAudioProcessingOverlay();
        }
      }
      
      // Check for orphaned overlay (processing flag false but overlay exists)
      const overlay = document.getElementById('processing-audio-overlay');
      if (overlay && !window._activeSpeechProcessing) {
        console.log('Found orphaned audio overlay - cleaning up');
        cleanupAudioProcessingOverlay();
      }
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(intervalId);
  }, []);
  
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
  
  // Function to handle direct file selection
  const processAudioFile = async (file: File) => {
    try {
      // Check if the file is an audio file
      if (!file.type.startsWith('audio/')) {
        alert('Please select an audio file (MP3, WAV, etc.)');
        return;
      }
      
      // Check file size (limit to ~10MB which is roughly 3 minutes of audio)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        alert('Audio file is too large. Please select a file under 10MB (approximately 3 minutes).');
        return;
      }

      // Clean up any existing overlays before starting new processing
      cleanupAudioProcessingOverlay();
      
      setIsProcessing(true);
      
      // Set global processing flag
      window._activeSpeechProcessing = true;
      window._lastProcessingStartTime = Date.now();
      
      // Create a visual indicator for processing
      const editorElement = document.getElementById('editor');
      if (editorElement) {
        // Mark editor as processing
        editorElement.classList.add('processing-audio');
        
        // Add processing overlay
        const overlay = document.createElement('div');
        overlay.id = 'processing-audio-overlay';
        overlay.className = 'processing-audio-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.borderRadius = '4px';
        overlay.style.zIndex = '10';
        overlay.style.background = 'radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, rgba(0, 0, 0, 0) 70%)';
        
        // Create a processing indicator
        const indicator = document.createElement('div');
        indicator.className = 'processing-indicator';
        indicator.style.padding = '12px 16px';
        indicator.style.backgroundColor = appTheme === 'dark' ? 'rgba(30, 58, 138, 0.9)' : 'rgba(219, 234, 254, 0.95)';
        indicator.style.color = appTheme === 'dark' ? 'rgb(191, 219, 254)' : 'rgb(30, 64, 175)';
        indicator.style.borderRadius = '8px';
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.justifyContent = 'center';
        indicator.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        indicator.style.backdropFilter = 'blur(4px)';
        indicator.style.fontSize = '14px';
        indicator.style.fontWeight = '500';
        
        // Create spinner
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner-inline';
        spinner.style.width = '16px';
        spinner.style.height = '16px';
        spinner.style.border = '2px solid rgba(59, 130, 246, 0.2)';
        spinner.style.borderTopColor = appTheme === 'dark' ? 'rgba(147, 197, 253, 0.9)' : 'rgba(59, 130, 246, 0.9)';
        spinner.style.borderRadius = '50%';
        spinner.style.marginRight = '10px';
        spinner.style.animation = 'spin 1s linear infinite';
        
        // Add animation style
        const style = document.createElement('style');
        style.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
        
        // Add text
        const text = document.createElement('span');
        text.textContent = `Processing "${file.name}"...`;
        
        indicator.appendChild(spinner);
        indicator.appendChild(text);
        overlay.appendChild(indicator);
        
        editorElement.style.position = 'relative';
        editorElement.appendChild(overlay);
        
        // Add a navigation event listener specifically for this processing session
        const cleanupOnNavigation = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target && (
            target.tagName === 'A' || 
            target.closest('a') ||
            target.closest('[role="button"]') ||
            target.closest('[role="tab"]') ||
            target.closest('.nav-item') ||
            target.closest('.sidebar-item')
          )) {
            console.log('Navigation detected during audio processing - cleaning up');
            cleanupAudioProcessingOverlay();
            document.removeEventListener('click', cleanupOnNavigation, true);
          }
        };
        
        // Add the listener
        document.addEventListener('click', cleanupOnNavigation, true);
      }
      
      // Read the file as ArrayBuffer - wrapped in a Promise
      const readFile = new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          try {
            if (!event.target?.result) {
              reject(new Error('Failed to read file'));
              return;
            }
            resolve(event.target.result as ArrayBuffer);
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = (error) => {
          reject(error);
        };
        
        // Read the file as an ArrayBuffer
        reader.readAsArrayBuffer(file);
      });
      
      // Process the file
      try {
        const buffer = await readFile;
        
        // Convert ArrayBuffer to Blob
        const blob = new Blob([buffer], { type: file.type });
        
        // Convert Blob to Base64
        const base64Audio = await blobToBase64(blob);
        
        // Process the audio using speech-to-text API
        const text = await speechToText(base64Audio);
        
        // Update the editor with transcribed text
        handleTextReceived(text);
      } catch (error) {
        console.error('Error processing audio file:', error);
        alert('Failed to transcribe audio file. Please try again or use a different file.');
      } finally {
        // Always clean up
        cleanupAudioProcessingOverlay();
      }
    } catch (error) {
      console.error('Error in file processing:', error);
      cleanupAudioProcessingOverlay();
    }
  };
  
  // Check if current provider is Ollama/OMNI Edge
  const provider = ctx.getProvider();
  const isOllamaProvider = provider.name === 'Ollama';
  
  // Disable speech for Ollama/OMNI Edge as it doesn't support the speech-to-text API
  const isDisabled = isOllamaProvider;
  
  // Toggle the expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Trigger file selection without using a file input element
  // This approach avoids the locale-related crash by using the File System Access API
  // with a fallback to traditional file input if needed
  const openFileUpload = async () => {
    try {
      // Try to use the modern File System Access API first
      // This avoids the problematic file input element
      if ('showOpenFilePicker' in window) {
        // @ts-ignore - TypeScript doesn't have types for this API yet
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{
            description: 'Audio Files',
            accept: {
              'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']
            }
          }],
          multiple: false
        });
        
        const file = await fileHandle.getFile();
        processAudioFile(file);
        return;
      }
      
      // Fallback to creating a temporary file input if needed
      if (fileInputContainerRef.current) {
        // Clear any existing input
        fileInputContainerRef.current.innerHTML = '';
        
        // Create the input programmatically
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.style.display = 'none';
        
        // Attach the event handler
        input.onchange = (e: Event) => {
          const files = (e.target as HTMLInputElement).files;
          if (files && files.length > 0) {
            processAudioFile(files[0]);
          }
          
          // Clean up the input after use
          if (fileInputContainerRef.current) {
            fileInputContainerRef.current.innerHTML = '';
          }
        };
        
        // Add to DOM and trigger click
        fileInputContainerRef.current.appendChild(input);
        
        // Add a small delay before clicking the input element
        // This helps prevent the locale initialization race condition
        setTimeout(() => {
          input.click();
        }, 50);
      }
    } catch (error) {
      console.error('Error opening file upload dialog:', error);
      cleanupAudioProcessingOverlay();
    }
  };
  
  return (
    <>
      <div className="flex items-center speech-control-wrapper">
        <div className="flex speech-button-container rounded-md overflow-hidden">
          <Tooltip
            content={isDisabled ? t('Common.SpeechNotSupported') : t('Common.SpeechToText')}
            relationship="label"
          >
            <div className="speech-button-wrapper">
              <SpeechButton 
                onTextReceived={handleTextReceived}
                onRecordingStateChange={handleRecordingStateChange}
                disabled={isDisabled || isProcessing}
                className={`${appTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'} ${
                  isExpanded ? 'speech-button-active' : ''
                } speech-button-main`}
                appTheme={appTheme}
              />
            </div>
          </Tooltip>
          
          {/* Expander button with chevron - now integrated with the STT button */}
          <Menu open={isExpanded} onOpenChange={(e, data) => setIsExpanded(data.open)}>
            <MenuTrigger disableButtonEnhancement>
              <button 
                type="button"
                className={`flex items-center justify-center speech-button-chevron ${
                  appTheme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
                } ${isExpanded ? 'bg-gray-200 dark:bg-gray-700' : 'bg-transparent'}
                focus:outline-none transition-all duration-200
                hover:bg-gray-200 dark:hover:bg-gray-700`}
                disabled={isDisabled || isProcessing || isRecording}
                onClick={toggleExpanded}
                title="More voice input options"
              >
                <ChevronDown16Regular className="w-2 h-2" />
              </button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem
                  icon={<ArrowUpload16Regular />}
                  onClick={openFileUpload}
                  disabled={isDisabled || isProcessing || isRecording}
                >
                  Upload Audio File
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
        
        {/* Container for dynamically created file inputs */}
        <div 
          ref={fileInputContainerRef} 
          style={{ display: 'none' }}
          data-purpose="file-input-container"
        />
      </div>
      
      {/* Add global styles for recording state */}
      <style>
        {`
          #editor.recording-active {
            background: linear-gradient(rgba(239, 68, 68, 0.05), transparent);
            border-color: rgba(239, 68, 68, 0.3) !important;
          }
          
          #editor.processing-audio {
            background: linear-gradient(rgba(59, 130, 246, 0.05), transparent);
            border-color: rgba(59, 130, 246, 0.3) !important;
          }
          
          .speech-control-wrapper {
            height: 30px;
          }
          
          .speech-button-container {
            display: flex;
            border-radius: 6px;
            overflow: hidden;
            height: 100%;
          }
          
          .speech-button-wrapper {
            height: 100%;
            display: flex;
          }
          
          .speech-button-main {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            height: 100%;
            display: flex;
            align-items: center;
          }
          
          .speech-button-chevron {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            border-top-right-radius: 6px;
            border-bottom-right-radius: 6px;
            height: 100%;
            padding: 0 3px;
            display: flex;
            align-items: center;
            min-width: 10px;
            width: 13px;
          }
          
          /* Make the actual buttons in SpeechButton match height */
          .speech-button-container button {
            height: 100%;
          }
          
          .speech-button-active {
            background-color: rgba(209, 213, 219, 0.3);
          }
        `}
      </style>
    </>
  );
} 