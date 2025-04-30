import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IChat } from 'intellichat/types';
import { Tooltip, Menu, MenuTrigger, MenuList, MenuItem, MenuPopover } from '@fluentui/react-components';
import { useTranslation } from 'react-i18next';
import { IChatContext } from 'intellichat/types';
import SpeechButton from 'components/SpeechButton';
import useChatStore from 'stores/useChatStore';
import useAppearanceStore from 'stores/useAppearanceStore';
import { ChevronDown16Regular, ArrowUpload16Regular } from '@fluentui/react-icons';
import { speechToText, blobToBase64 } from 'utils/util';
import Mousetrap from 'mousetrap';

// Add type definition for the window object to include activeSttAbortController
declare global {
  interface Window {
    _activeSpeechProcessing?: boolean;
    _lastProcessingStartTime?: number;
    _openAudioContexts?: AudioContext[];
    activeSttAbortController?: AbortController | null;
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
  
  const fileInputContainerRef = useRef<HTMLDivElement>(null);
  
  // Add a comprehensive resource cleanup function
  const cleanupResources = useCallback(() => {
    // Clear all audio processing resources
    try {
      // 1. Abort any ongoing STT requests
      if (window.activeSttAbortController) {
        window.activeSttAbortController.abort();
        window.activeSttAbortController = null;
      }
      
      // 2. Clear global processing flags
      window._activeSpeechProcessing = false;
      
      // 3. Clean up file input container
      if (fileInputContainerRef.current) {
        fileInputContainerRef.current.innerHTML = '';
      }
      
      // 4. Remove any audio processing overlays
      cleanupAudioProcessingOverlay();
      
      // 5. Reset UI state
      setIsProcessing(false);
      setIsRecording(false);
      
      // 6. Release any AudioContext instances that might be left open
      const audioContexts = (window as any)._openAudioContexts || [];
      if (audioContexts.length > 0) {
        console.log(`Cleaning up ${audioContexts.length} open AudioContext instances`);
        audioContexts.forEach((ctx: AudioContext) => {
          try {
            if (ctx && ctx.state !== 'closed') {
              ctx.close().catch(err => 
                console.warn('Error closing AudioContext during cleanup:', err)
              );
            }
          } catch (err) {
            console.warn('Error during AudioContext cleanup:', err);
          }
        });
        (window as any)._openAudioContexts = [];
      }
    } catch (err) {
      console.error('Error during resource cleanup:', err);
    }
  }, []);
  
  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);
  
  // Cleanup on navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupResources();
    };
    
    // Add event listeners for navigation/page close
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cleanupResources]);
  
  // Clean up the audio processing UI (simplified as we've removed the overlay)
  function cleanupAudioProcessingOverlay() {
    // Just remove the processing class from the container
    const inputContainer = document.querySelector('.ask-omni-container') as HTMLElement;
    if (inputContainer) {
      inputContainer.classList.remove('processing-audio');
    }
    
    setIsProcessing(false);
  }
  
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
  
  // Handle recording state change
  const handleRecordingStateChange = (recording: boolean) => {
    setIsRecording(recording);
    
    // Add visualization directly to the button
    const micButton = document.querySelector('.speech-button-main button') as HTMLElement;
    if (micButton) {
      if (recording) {
        // Add custom audio visualization to the button
        const style = document.createElement('style');
        style.id = 'mic-visualization-style';
        style.textContent = `
          .speech-button-main button {
            position: relative;
            overflow: hidden;
          }
          
          .speech-button-wrapper {
            margin-bottom: 0 !important; /* Force button to stay in place */
          }
          
          @keyframes pulse-mic {
            0% { transform: scale(1); opacity: 0.9; }
            50% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); opacity: 0.9; }
          }
          
          .speech-button-main button::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(239, 68, 68, 0.8);
            z-index: -1;
            animation: pulse-mic 1s infinite ease-in-out;
          }
          
          .speech-button-main button svg {
            color: white !important;
            position: relative;
            z-index: 2;
          }
        `;
        document.head.appendChild(style);
        
        // Create audio analysis for responsive visualization
        setupAudioVisualization(micButton);
      } else {
        // Remove custom styles when recording stops
        const customStyle = document.getElementById('mic-visualization-style');
        if (customStyle) {
          document.head.removeChild(customStyle);
        }
        
        // Clean up audio visualization
        cleanupAudioVisualization();
      }
    }
  };
  
  // Audio analysis variables
  let audioContext: AudioContext | null = null;
  let audioAnalyser: AnalyserNode | null = null;
  let animationFrame: number | null = null;
  
  // Setup audio visualization that responds to actual audio input
  function setupAudioVisualization(buttonElement: HTMLElement): void {
    try {
      // Create audio context and analyzer
      audioContext = new AudioContext();
      audioAnalyser = audioContext.createAnalyser();
      audioAnalyser.fftSize = 256;
      
      // Get microphone stream
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const source = audioContext!.createMediaStreamSource(stream);
          source.connect(audioAnalyser!);
          
          // Start visualization loop
          function updateVisualization() {
            if (!audioAnalyser || !buttonElement) return;
            
            const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
            audioAnalyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            
            // Scale from 0-255 to 0-1 range
            const normalizedVolume = Math.min(average / 255 * 1.5, 1);
            
            // Apply visual effect to button based on volume
            buttonElement.style.boxShadow = `0 0 ${5 + normalizedVolume * 15}px rgba(239, 68, 68, ${0.5 + normalizedVolume * 0.5})`;
            
            // Continue animation loop
            animationFrame = requestAnimationFrame(updateVisualization);
          }
          
          // Start the visualization
          animationFrame = requestAnimationFrame(updateVisualization);
          
          // Store stream in window to track active streams
          if (!window._openAudioContexts) {
            window._openAudioContexts = [];
          }
          window._openAudioContexts.push(audioContext!);
        })
        .catch(err => {
          console.error('Error accessing microphone for visualization:', err);
        });
    } catch (err) {
      console.error('Error setting up audio visualization:', err);
    }
  }
  
  // Clean up audio visualization resources
  function cleanupAudioVisualization() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    
    if (audioContext) {
      audioContext.close().catch(err => 
        console.warn('Error closing AudioContext:', err)
      );
      audioContext = null;
      audioAnalyser = null;
    }
    
    // Reset button styles
    const micButton = document.querySelector('.speech-button-main button') as HTMLElement;
    if (micButton) {
      micButton.style.boxShadow = '';
    }
  }
  
  // Handle text received from speech recognition
  const handleTextReceived = (text: string) => {
    setIsProcessing(false);
    setIsRecording(false);
    
    if (!text) return;
    
    // Get the current editor element
    const currentEditorElement = document.getElementById('editor');
    if (!currentEditorElement) return;
    
    // Append the transcribed text to the editor
    const currentContent = currentEditorElement.innerHTML || '';
    
    // Check if we need to add a space between existing content and new text
    const needsSpace = currentContent && 
      !currentContent.endsWith(' ') && 
      !currentContent.endsWith('\n') && 
      !currentContent.endsWith('.') && 
      !currentContent.endsWith('!') && 
      !currentContent.endsWith('?') && 
      !currentContent.endsWith(',') && 
      !currentContent.endsWith(':') && 
      !currentContent.endsWith(';') && 
      !text.startsWith(' ') && 
      !text.startsWith('\n');
    
    const newContent = currentContent 
      ? `${currentContent}${needsSpace ? ' ' : ''}${text}` 
      : text;
    
    // Update the editor content
    currentEditorElement.innerHTML = newContent;
    
    // Save the new content to the chat state
    editStage(chat.id, { input: newContent });
    
    // Hide placeholder text when adding content
    const placeholderElement = document.querySelector('.placeholder-text') as HTMLElement;
    if (placeholderElement) {
      placeholderElement.style.display = 'none';
    }
    
    // Additionally, update any component state that controls the placeholder
    // This uses a custom event to notify the editor component
    const hidePlaceholderEvent = new CustomEvent('editorContentChanged', { detail: { hasContent: true } });
    currentEditorElement.dispatchEvent(hidePlaceholderEvent);
    
    // Set focus back to the editor
    currentEditorElement.focus();
    
    // Move cursor to the end
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(currentEditorElement);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  
  // Add speech control styles
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.id = 'speech-ctrl-styles';
    styleEl.innerHTML = `
      .speech-button-container {
        position: relative;
        transition: all 0.3s ease;
        display: flex;
        height: 32px;
        border-radius: 6px;
        overflow: visible !important;
        max-width: 34px !important;
      }
      
      .speech-button-wrapper {
        position: relative;
        transition: all 0.3s ease;
        margin: 0;
        height: 32px;
        max-width: 28px !important;
        position: relative;
        z-index: 2;
      }
      
      .speech-button-wrapper button {
        transition: all 0.3s ease;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 32px !important;
        width: 24px !important;
        min-width: 24px !important;
        padding: 0 !important;
        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;
      }

      .speech-button-wrapper button svg {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 2 !important;
      }
      
      .speech-button-active {
        background-color: rgba(239, 68, 68, 0.9) !important;
        color: white !important;
      }
      
      .speech-button-active svg {
        color: white !important;
      }

      /* Audio visualization bars */
      .speech-button-active::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        background: linear-gradient(0deg, 
          rgba(239, 68, 68, 0.9) 20%, 
          rgba(239, 68, 68, 0.7) 40%,
          rgba(239, 68, 68, 0.5) 60%,
          rgba(239, 68, 68, 0.3) 80%,
          transparent 100%
        );
        animation: audio-bars 0.5s ease-in-out infinite alternate;
        z-index: 1;
      }

      @keyframes audio-bars {
        0% {
          clip-path: path('M0,36 L8,32 L16,28 L24,34 L32,30 L40,36');
        }
        50% {
          clip-path: path('M0,36 L8,28 L16,34 L24,30 L32,36 L40,32');
        }
        100% {
          clip-path: path('M0,36 L8,34 L16,30 L24,36 L32,28 L40,34');
        }
      }
      
      .processing-button {
        background-color: rgba(59, 130, 246, 0.9) !important;
        color: white !important;
      }

      /* Speech button chevron styling */
      .speech-button-chevron {
        position: absolute !important;
        right: -28px !important;
        top: 0 !important;
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;
        border-top-right-radius: 6px !important;
        border-bottom-right-radius: 6px !important;
        height: 32px !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 3px !important;
        width: 3px !important;
        background-color: transparent !important;
        border: none !important;
        z-index: 1 !important;
        opacity: 0.7 !important;
      }
      
      .speech-button-chevron:hover {
        opacity: 1 !important;
      }
      
      .speech-button-chevron svg {
        width: 8px !important;
        height: 8px !important;
        margin-left: -2px !important;
        position: relative !important;
      }
    `;
    
    if (!document.getElementById('speech-ctrl-styles')) {
      document.head.appendChild(styleEl);
    }
    
    return () => {
      const existingStyle = document.getElementById('speech-ctrl-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, [isRecording, isProcessing]); // Only depend on these state variables
  
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
      
      // Create a visual indicator for processing - now targeting the input container
      const inputContainer = document.querySelector('.ask-omni-container') as HTMLElement;
      if (inputContainer) {
        // Mark container as processing
        inputContainer.classList.add('processing-audio');
        
        // We're not adding a processing overlay anymore
        console.log('Processing audio file - no overlay will be added per UI update');
      }
      
      // Create an AbortController to allow cancellation
      window.activeSttAbortController = new AbortController();
      const signal = window.activeSttAbortController.signal;
      
      try {
        // Read the file as ArrayBuffer
        const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (!event.target?.result) {
              reject(new Error('Failed to read file'));
              return;
            }
            resolve(event.target.result as ArrayBuffer);
          };
          reader.onerror = (error) => reject(error);
          reader.readAsArrayBuffer(file);
        });
        
        // Convert ArrayBuffer to Blob
        const blob = new Blob([buffer], { type: file.type });
        
        // Convert Blob to Base64
        const base64Audio = await blobToBase64(blob);
        
        // Log the start of transcription
        console.log(`Starting transcription of audio file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        
        // Process the audio using speech-to-text API
        const text = await speechToText(base64Audio, signal);
        
        console.log('Transcription complete:', text ? text.substring(0, 50) + '...' : 'No text returned');
        
        // Update the editor with transcribed text
        handleTextReceived(text);
      } catch (error: any) {
        // Handle abortion separately
        if (error.name === 'AbortError') {
          console.log('Audio file transcription was cancelled');
          return;
        }
        
        console.error('Error processing audio file:', error);
        alert(`Failed to transcribe audio file: ${error.message || 'Unknown error'}`);
      } finally {
        // Reset abort controller
        window.activeSttAbortController = null;
        
        // Always clean up
        cleanupAudioProcessingOverlay();
        setIsProcessing(false);
        window._activeSpeechProcessing = false;
      }
    } catch (error) {
      console.error('Error in file processing:', error);
      cleanupAudioProcessingOverlay();
      setIsProcessing(false);
      window._activeSpeechProcessing = false;
    }
  };
  
  // Check if current provider is Ollama/OMNI Edge
  const provider = ctx.getProvider();
  const isOllamaProvider = provider.name === 'Ollama';
  const isDisabled = isOllamaProvider || isProcessing; // Disable while processing
  
  // Toggle the expanded state (for menu)
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Trigger file selection
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

  // Handler for the file input change event
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processAudioFile(files[0]);
    }
  };

  // Setup keyboard shortcut for Speech-to-Text
  useEffect(() => {
    Mousetrap.bind('alt+s', () => {
      // Find and click the speech button directly in the DOM
      const speechButtonElement = document.querySelector('.speech-button-main button');
      if (speechButtonElement instanceof HTMLElement) {
        speechButtonElement.click();
        return false;
      }
      return true;
    });

    return () => {
      Mousetrap.unbind('alt+s');
    };
  }, []);

  // Add an effect to ensure the mic icon is visible
  useEffect(() => {
    // Wait for DOM to be ready
    const fixMicIcon = () => {
      const micButton = document.querySelector('.speech-button-main button');
      const micIcon = document.querySelector('.speech-button-main button svg');
      
      if (micButton && micIcon) {
        // Force the icon to be visible
        (micIcon as HTMLElement).style.display = 'block';
        (micIcon as HTMLElement).style.visibility = 'visible';
        (micIcon as HTMLElement).style.opacity = '1';
        (micIcon as HTMLElement).style.position = 'relative';
        (micIcon as HTMLElement).style.zIndex = '10';
        
        // Make the button display flex to center the icon
        (micButton as HTMLElement).style.display = 'flex';
        (micButton as HTMLElement).style.alignItems = 'center';
        (micButton as HTMLElement).style.justifyContent = 'center';
      }
    };
    
    // Run immediately
    fixMicIcon();
    
    // Also run after a short delay to ensure it applies after any other scripts
    const timerId = setTimeout(fixMicIcon, 500);
    
    return () => {
      clearTimeout(timerId);
    };
  }, [isRecording, isExpanded]);

  const customStyles = {
    chevronButton: {
      minWidth: '32px',
      width: '32px',
      height: '36px',
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    audioBar: {
      height: '24px', // Increased from previous height
      width: '3px',
      backgroundColor: 'var(--colorNeutralForeground1)',
      margin: '0 1px',
      animation: 'audio-wave 1.2s ease-in-out infinite',
      transformOrigin: 'bottom',
    }
  };

  // Add this before the return statement
  const audioVisualizerStyles = `
    @keyframes audio-wave {
      0% { transform: scaleY(0.3); }
      50% { transform: scaleY(1); }
      100% { transform: scaleY(0.3); }
    }
  `;

  return (
    <>
      <style>{audioVisualizerStyles}</style>
      <div className="speech-control-wrapper">
        <Tooltip
          content={
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Speech')}</div>
              <div>{t('Editor.Toolbar.SpeechInputHelp')} (Ctrl+Shift+9)</div>
            </div>
          }
          relationship="description"
          positioning="before"
        >
          <div className="flex items-center speech-button-container">
            <div className="speech-button-wrapper">
              <SpeechButton
                onTextReceived={handleTextReceived}
                onRecordingStateChange={handleRecordingStateChange}
                disabled={isDisabled}
                className={` 
                  ${isRecording ? 'speech-button-active' : ''} 
                  ${isProcessing ? 'processing-button' : ''} 
                  speech-button-main`}
                appTheme={appTheme}
              />
            </div>
            <Menu open={isExpanded} onOpenChange={(e, data) => setIsExpanded(data.open)}>
              <MenuTrigger disableButtonEnhancement>
                <button
                  type="button"
                  className="speech-button-chevron"
                  disabled={isDisabled || isRecording || isProcessing}
                  onClick={toggleExpanded}
                  title="More voice input options"
                  style={{ position: 'absolute', zIndex: 1 }}
                >
                  <ChevronDown16Regular />
                </button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    icon={<ArrowUpload16Regular />}
                    onClick={openFileUpload}
                    disabled={isDisabled}
                  >
                    Upload Audio File
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </Tooltip>
        
        {/* Container for dynamically created file inputs */}
        <div 
          ref={fileInputContainerRef} 
          style={{ display: 'none' }}
          data-purpose="file-input-container"
        />
      </div>
    </>
  );
} 