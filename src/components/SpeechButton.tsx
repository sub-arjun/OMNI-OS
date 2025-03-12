import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AudioRecorder, blobToBase64, speechToText, createWaveformCanvas } from '../utils/util';
import { Mic20Regular, MicOff20Regular, MicPulse20Regular, DismissRegular, StatusRegular } from '@fluentui/react-icons';

// Maximum recording time in seconds (2 minutes)
const MAX_RECORDING_TIME = 120;

interface SpeechButtonProps {
  onTextReceived: (text: string) => void;
  disabled?: boolean;
  className?: string;
  onRecordingStateChange?: (isRecording: boolean) => void;
  appTheme?: 'light' | 'dark';
}

// Use traditional export style and a simple function component
export default function SpeechButton(props: SpeechButtonProps) {
  const { onTextReceived, disabled = false, className = '', onRecordingStateChange, appTheme = 'light' } = props;
  
  // Core state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveformRef = useRef<{ canvas: HTMLCanvasElement; stop: () => void } | null>(null);
  const timerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  
  // Update recording state safely
  function updateRecordingState(value: boolean) {
    if (isMountedRef.current) {
      setIsRecording(value);
      if (onRecordingStateChange) {
        onRecordingStateChange(value);
      }
    }
  }
  
  // Cancel speech-to-text processing
  function cancelProcessing() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Remove transcribing overlay if it exists
    const transcribingOverlay = document.getElementById('transcribing-overlay');
    if (transcribingOverlay && transcribingOverlay.parentNode) {
      transcribingOverlay.parentNode.removeChild(transcribingOverlay);
    }
    
    if (isMountedRef.current) {
      setIsProcessing(false);
      setError('Processing canceled');
      // Clear error after 3 seconds
      setTimeout(() => {
        if (isMountedRef.current) {
          setError(null);
        }
      }, 3000);
    }
  }
  
  // Clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
      if (waveformRef.current) {
        waveformRef.current.stop();
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      // Also abort any in-progress STT requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // Stop recording
  function stopRecording() {
    if (recorderRef.current) {
      recorderRef.current.stop();
      updateRecordingState(false);
    }
  }
  
  // Start recording
  async function startRecording() {
    if (isMountedRef.current) {
      setError(null);
      setRecordingDuration(0);
    }
    
    try {
      // Create and start recorder
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();
      updateRecordingState(true);
      
      // Set up recording duration timer with max time limit
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      
      timerRef.current = window.setInterval(() => {
        if (isMountedRef.current) {
          setRecordingDuration(prev => {
            const newDuration = prev + 1;
            // Auto-stop recording when reaching the maximum time
            if (newDuration >= MAX_RECORDING_TIME) {
              console.log('Maximum recording time reached (2 minutes). Stopping recording.');
              if (timerRef.current) {
                window.clearInterval(timerRef.current);
              }
              stopRecording();
            }
            return newDuration;
          });
        }
      }, 1000);
      
      // Set up waveform visualization
      const editorElement = document.getElementById('editor');
      const targetContainer = editorElement || containerRef.current;
      
      if (targetContainer && recorderRef.current) {
        const stream = recorderRef.current.getStream();
        if (stream) {
          waveformRef.current = createWaveformCanvas(targetContainer, stream);
          
          // If we're using the editor as container, add a recording overlay
          if (editorElement) {
            const overlay = document.createElement('div');
            overlay.id = 'recording-overlay';
            overlay.className = 'recording-overlay';
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
            overlay.style.background = 'radial-gradient(circle, rgba(239, 68, 68, 0.05) 0%, rgba(0, 0, 0, 0) 70%)';
            
            // Create a stop button
            const stopButton = document.createElement('button');
            stopButton.id = 'recording-stop-button';
            stopButton.className = 'recording-stop-button';
            stopButton.style.padding = '12px 24px';
            stopButton.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
            stopButton.style.color = 'white';
            stopButton.style.borderRadius = '24px';
            stopButton.style.border = 'none';
            stopButton.style.cursor = 'pointer';
            stopButton.style.boxShadow = '0 2px 10px rgba(239, 68, 68, 0.4)';
            stopButton.style.transition = 'all 0.2s ease';
            stopButton.style.display = 'flex';
            stopButton.style.alignItems = 'center';
            stopButton.style.justifyContent = 'center';
            stopButton.style.fontSize = '14px';
            stopButton.style.fontWeight = '500';
            stopButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;"><rect x="6" y="6" width="12" height="12" rx="1" fill="white"/></svg> Stop Recording';
            
            // Add hover effect
            stopButton.onmouseover = () => {
              stopButton.style.backgroundColor = 'rgba(239, 68, 68, 1)';
              stopButton.style.transform = 'scale(1.05)';
              stopButton.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.5)';
            };
            
            stopButton.onmouseout = () => {
              stopButton.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
              stopButton.style.transform = 'scale(1)';
              stopButton.style.boxShadow = '0 2px 10px rgba(239, 68, 68, 0.4)';
            };
            
            // Add click handler to stop recording
            stopButton.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation(); // Prevent editor from getting focus
              stopRecording();
            };
            
            overlay.appendChild(stopButton);
            editorElement.style.position = 'relative';
            editorElement.appendChild(overlay);
          }
        }
      }
      
      // Handle recording stop
      recorderRef.current.onStop(async (audioBlob) => {
        // Clean up visualization
        if (waveformRef.current) {
          waveformRef.current.stop();
          waveformRef.current = null;
        }
        
        // Remove overlay if it exists
        const overlay = document.getElementById('recording-overlay');
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        if (isMountedRef.current) {
          setIsProcessing(true);
          
          // Create transcribing overlay similar to recording overlay
          const editorElement = document.getElementById('editor');
          if (editorElement) {
            // Create transcribing overlay
            const transcribingOverlay = document.createElement('div');
            transcribingOverlay.id = 'transcribing-overlay';
            transcribingOverlay.className = 'transcribing-overlay';
            transcribingOverlay.style.position = 'absolute';
            transcribingOverlay.style.top = '0';
            transcribingOverlay.style.left = '0';
            transcribingOverlay.style.width = '100%';
            transcribingOverlay.style.height = '100%';
            transcribingOverlay.style.display = 'flex';
            transcribingOverlay.style.alignItems = 'center';
            transcribingOverlay.style.justifyContent = 'center';
            transcribingOverlay.style.borderRadius = '4px';
            transcribingOverlay.style.zIndex = '10';
            transcribingOverlay.style.background = 'radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, rgba(0, 0, 0, 0) 70%)';
            
            // Create transcribing indicator card
            const indicatorCard = document.createElement('div');
            indicatorCard.id = 'transcribing-card';
            indicatorCard.className = 'transcribing-card';
            indicatorCard.style.padding = '12px 16px';
            indicatorCard.style.backgroundColor = appTheme === 'dark' ? 'rgba(30, 58, 138, 0.9)' : 'rgba(219, 234, 254, 0.95)';
            indicatorCard.style.color = appTheme === 'dark' ? 'rgb(191, 219, 254)' : 'rgb(30, 64, 175)';
            indicatorCard.style.borderRadius = '8px';
            indicatorCard.style.display = 'flex';
            indicatorCard.style.alignItems = 'center';
            indicatorCard.style.justifyContent = 'center';
            indicatorCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            indicatorCard.style.backdropFilter = 'blur(4px)';
            indicatorCard.style.fontSize = '14px';
            indicatorCard.style.fontWeight = '500';
            indicatorCard.style.animation = 'fade-in 0.2s ease-out forwards';
            
            // Create spinner
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner-inline';
            spinner.style.width = '16px';
            spinner.style.height = '16px';
            spinner.style.border = '2px solid rgba(59, 130, 246, 0.2)';
            spinner.style.borderTopColor = appTheme === 'dark' ? 'rgba(147, 197, 253, 0.9)' : 'rgba(59, 130, 246, 0.9)';
            spinner.style.borderRadius = '50%';
            spinner.style.marginRight = '10px';
            spinner.style.animation = 'spinner 0.7s linear infinite';
            
            // Create text span
            const textSpan = document.createElement('span');
            textSpan.innerText = 'Transcribing audio...';
            
            // Create cancel button
            const cancelButton = document.createElement('button');
            cancelButton.style.marginLeft = '12px';
            cancelButton.style.background = 'none';
            cancelButton.style.border = 'none';
            cancelButton.style.padding = '4px';
            cancelButton.style.cursor = 'pointer';
            cancelButton.style.color = appTheme === 'dark' ? 'rgb(147, 197, 253)' : 'rgb(37, 99, 235)';
            cancelButton.style.opacity = '0.85';
            cancelButton.style.transition = 'all 0.2s ease';
            cancelButton.style.borderRadius = '4px';
            cancelButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18L18 6M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            
            // Add hover effect 
            cancelButton.onmouseover = () => {
              cancelButton.style.opacity = '1';
              cancelButton.style.backgroundColor = appTheme === 'dark' ? 'rgba(30, 58, 138, 0.5)' : 'rgba(219, 234, 254, 0.5)';
            };
            
            cancelButton.onmouseout = () => {
              cancelButton.style.opacity = '0.85';
              cancelButton.style.backgroundColor = 'transparent';
            };
            
            // Add click handler to cancel processing
            cancelButton.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation(); // Prevent editor from getting focus
              cancelProcessing();
            };
            
            // Assemble the indicator
            indicatorCard.appendChild(spinner);
            indicatorCard.appendChild(textSpan);
            indicatorCard.appendChild(cancelButton);
            transcribingOverlay.appendChild(indicatorCard);
            
            // Add to the editor
            editorElement.style.position = 'relative';
            editorElement.appendChild(transcribingOverlay);
          }
        }
        
        try {
          // Create an AbortController for the fetch request
          abortControllerRef.current = new AbortController();
          
          // Convert blob to base64
          console.log('Converting audio blob to base64...');
          console.log('Audio blob size:', audioBlob.size, 'bytes');
          const base64Audio = await blobToBase64(audioBlob);
          console.log('Base64 conversion complete. Length:', base64Audio.length);
          
          if (!isMountedRef.current) return; // Check if component is still mounted
          
          // Send to speech-to-text API with abort signal
          console.log('Sending request to speech-to-text API...');
          const text = await speechToText(base64Audio, abortControllerRef.current.signal);
          console.log('Speech-to-text API response received:', text ? 'Success' : 'Empty/null result');
          
          if (!isMountedRef.current) return; // Check after async operation
          
          // Reset abort controller
          abortControllerRef.current = null;
          
          // Remove transcribing overlay if it exists
          const transcribingOverlay = document.getElementById('transcribing-overlay');
          if (transcribingOverlay && transcribingOverlay.parentNode) {
            transcribingOverlay.parentNode.removeChild(transcribingOverlay);
          }
          
          if (isMountedRef.current) {
            setIsProcessing(false);
            onTextReceived(text || '');
          }
        } catch (err: any) {
          // Only show error if not aborted and component is mounted
          console.error('Speech-to-text error details:', err);
          
          if (isMountedRef.current && err.name !== 'AbortError') {
            setError(err.message || 'Failed to convert speech to text');
            setTimeout(() => {
              if (isMountedRef.current) setError(null);
            }, 5000);
          }
          console.error('Speech to text error:', err);
          
          // Remove transcribing overlay if it exists
          const transcribingOverlay = document.getElementById('transcribing-overlay');
          if (transcribingOverlay && transcribingOverlay.parentNode) {
            transcribingOverlay.parentNode.removeChild(transcribingOverlay);
          }
        }
      });
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to start recording');
        setTimeout(() => {
          if (isMountedRef.current) setError(null);
        }, 5000);
      }
      console.error('Recording error:', err);
      
      // Clean up the timer if there's an error
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Remove overlay if it exists
      const overlay = document.getElementById('recording-overlay');
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }
  }
  
  // Toggle recording
  async function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }
  
  // Create button className with theme-aware styling
  const buttonClassName = `p-1.5 rounded-md ${
    appTheme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
  } focus:outline-none transition-all duration-200 transform ${
    isRecording 
      ? 'text-red-500 scale-110 ' + (appTheme === 'dark' ? 'bg-red-900 bg-opacity-30' : 'bg-red-100') + ' pulse-animation' 
      : isProcessing
        ? 'text-blue-500 scale-110 ' + (appTheme === 'dark' ? 'bg-blue-900 bg-opacity-60' : 'bg-blue-300') + ' processing-pulse'
        : 'text-blue-500 hover:text-blue-600 ' + (appTheme === 'dark' ? 'text-blue-400 hover:text-blue-300' : '')
  } ${className}`;
  
  // Effect to position the transcribing indicator in the editor
  useEffect(() => {
    if (isProcessing && indicatorRef.current) {
      const editorElement = document.getElementById('editor');
      
      if (editorElement) {
        // Ensure editor is positioned relatively
        editorElement.style.position = 'relative';
        
        // Move the indicator to the editor
        editorElement.appendChild(indicatorRef.current);
      }
    }
    
    return () => {
      // Clean up - remove the indicator from the DOM when not processing
      if (indicatorRef.current && indicatorRef.current.parentNode) {
        indicatorRef.current.parentNode.removeChild(indicatorRef.current);
      }
    };
  }, [isProcessing]);
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={isProcessing ? cancelProcessing : toggleRecording}
        disabled={disabled}
        className={buttonClassName}
        title={isProcessing ? 'Cancel transcription' : 
               isRecording ? 'Stop recording' : 'Start speech input'}
        aria-label={isProcessing ? 'Cancel transcription' : 
                    isRecording ? 'Stop recording' : 'Start speech input'}
        style={{ 
          boxShadow: isRecording ? '0 0 0 2px rgba(239, 68, 68, 0.4)' : 
                    isProcessing ? '0 0 0 1px rgba(59, 130, 246, 0.25)' : 'none',
          transform: isProcessing ? 'scale(1.05)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        {isProcessing ? (
          <DismissRegular className="w-5 h-5 text-blue-500 processing-icon" />
        ) : isRecording ? (
          <MicOff20Regular className="w-5 h-5" />
        ) : (
          <Mic20Regular className="w-5 h-5" />
        )}
      </button>
      
      {/* Error message */}
      {error && (
        <div className={`absolute bottom-10 right-0 ${
          appTheme === 'dark' 
            ? 'bg-red-900/50 text-red-400 border-red-800' 
            : 'bg-red-100 text-red-800 border-red-200'
        } p-2 rounded-md text-xs w-64 z-50 border`}>
          <div className="flex items-start">
            <StatusRegular className="w-3.5 h-3.5 mt-0.5 mr-1.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        </div>
      )}
      
      {/* Fallback container for waveform visualization */}
      <div ref={containerRef} className="hidden" />
      
      <style>
        {`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
        .pulse-animation {
          animation: pulse 2s infinite;
        }
        
        @keyframes processing-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        .processing-pulse {
          animation: processing-pulse 1.5s infinite;
        }
        
        @keyframes processing-icon-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .processing-icon {
          animation: processing-icon-spin 1s linear infinite;
        }
        
        .recording-stop-button {
          animation: pulse-button 2s infinite;
        }
        @keyframes pulse-button {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
        
        .processing-card {
          animation: slide-up 0.3s ease-out;
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(59, 130, 246, 0.2);
          border-top-color: rgba(59, 130, 246, 0.9);
          border-radius: 50%;
          animation: spinner 0.7s linear infinite;
        }
        @keyframes spinner {
          to {
            transform: rotate(360deg);
          }
        }
        .loading-bar {
          width: 100%;
          animation: loading-progress 1.5s ease infinite;
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.9), rgba(124, 58, 237, 0.9), rgba(59, 130, 246, 0.9));
          background-size: 200% 100%;
        }
        @keyframes loading-progress {
          0% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        /* Add specific styles for the small spinner */
        .loading-spinner.w-3 {
          border-width: 1.5px;
        }
        
        /* Update styles for the centered spinner */
        .loading-spinner.w-4 {
          border-width: 2px;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
        }
        
        /* Add a subtle pulsing animation to the transcribing container */
        @keyframes subtle-pulse {
          0% {
            opacity: 0.95;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
          100% {
            opacity: 0.95;
            transform: scale(1);
          }
        }
        
        /* Add fade-in animation for the transcribing indicator */
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        /* Animation for the inline spinner in the transcribing indicator */
        .loading-spinner-inline {
          animation: spinner 0.8s linear infinite;
        }
        
        /* Animation for the transcribing card */
        .transcribing-card {
          animation: fade-in 0.2s ease-out forwards, subtle-pulse 2s ease-in-out infinite;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
          transition: all 0.3s ease;
        }
        `}
      </style>
    </div>
  );
} 