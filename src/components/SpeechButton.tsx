import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AudioRecorder, blobToBase64, speechToText, REPLICATE_API_KEY } from '../utils/util';
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
  const predictionIdRef = useRef<string | null>(null);
  const isPredictionPollingRef = useRef(false);
  
  // Update recording state safely
  function updateRecordingState(value: boolean) {
    if (isMountedRef.current) {
      setIsRecording(value);
      if (onRecordingStateChange) {
        onRecordingStateChange(value);
      }
    }
  }
  
  // Function to handle cleanup of audio processing resources
  const cleanupAudioResources = useCallback(() => {
    // Clean up waveform visualization
    if (waveformRef.current) {
      waveformRef.current.stop();
      waveformRef.current = null;
    }
    
    // Clear timers
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Abort any in-progress STT requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
    }
    
    // Clean up recorder
    if (recorderRef.current) {
      recorderRef.current.cleanup();
      recorderRef.current = null;
    }
    
    // Remove any overlay elements
    const overlay = document.getElementById('recording-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    
    const processingOverlay = document.getElementById('transcribing-overlay');
    if (processingOverlay && processingOverlay.parentNode) {
      processingOverlay.parentNode.removeChild(processingOverlay);
    }
    
    // Reset UI state
    updateRecordingState(false);
    if (isMountedRef.current) {
      setIsProcessing(false);
      setRecordingDuration(0);
    }
  }, [updateRecordingState]);

  // Set up cleanup on component unmount
  useEffect(() => {
    // Initialize mount state to true
    isMountedRef.current = true;
    
    return () => {
      // When unmounting, we should not immediately abort processing
      // Instead, mark that any UI updates should stop but let the processing complete
      console.log('Component unmounting, setting isMountedRef to false');
      isMountedRef.current = false;
      
      // Don't clean up audio resources here to allow processing to complete
      // Only clean up UI elements
      cleanupUIOnly();
    };
  }, []);
  
  // Add a new function to clean up only UI elements
  const cleanupUIOnly = useCallback(() => {
    // Clean up waveform visualization
    if (waveformRef.current) {
      waveformRef.current.stop();
      waveformRef.current = null;
    }
    
    // Clear timers
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Remove any overlay elements
    const overlay = document.getElementById('recording-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    
    const processingOverlay = document.getElementById('transcribing-overlay');
    if (processingOverlay && processingOverlay.parentNode) {
      processingOverlay.parentNode.removeChild(processingOverlay);
    }
  }, []);
  
  // Stop recording
  function stopRecording() {
    if (recorderRef.current) {
      recorderRef.current.stop();
      updateRecordingState(false);
    }
  }
  
  // Cancel ongoing processing
  function cancelProcessing() {
    cancelTranscription();
  }
  
  // Start recording
  async function startRecording() {
    try {
      console.log('Starting recording - complete rewrite');
      
      // Reset state
      setError(null);
      setRecordingDuration(0);
      
      // Create new recorder
      recorderRef.current = new AudioRecorder();
      
      // Set up timer
      timerRef.current = window.setInterval(() => {
        if (isMountedRef.current) {
          setRecordingDuration(prev => {
            const newDuration = prev + 1;
            if (newDuration >= MAX_RECORDING_TIME) {
              stopRecording();
              if (timerRef.current !== null) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
              }
            }
            return newDuration;
          });
        }
      }, 1000);
      
      // Start the recorder
      await recorderRef.current.start();
      updateRecordingState(true);
      
      // Set up callback for when recording stops
      if (recorderRef.current) {
        recorderRef.current.onStop((audioBlob) => {
          processAudioData(audioBlob);
        });
      }
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording: ' + (err as Error).message);
      cleanupAudioResources();
    }
  }
  
  // Modify the processAudioData function to continue processing even when unmounted
  async function processAudioData(audioBlob: Blob) {
    try {
      console.log('processAudioData: Starting with blob size', audioBlob.size, 'bytes');
      
      // Make a durable copy of the blob to prevent any garbage collection issues
      const durableBlob = new Blob([audioBlob], { type: audioBlob.type });
      console.log('processAudioData: Created durable blob copy:', durableBlob.size, 'bytes, type:', durableBlob.type);
      
      // Clean up recording UI
      const overlay = document.getElementById('recording-overlay');
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
        console.log('processAudioData: Removed recording overlay');
      }
      
      if (waveformRef.current) {
        waveformRef.current.stop();
        waveformRef.current = null;
        console.log('processAudioData: Stopped waveform visualization');
      }
      
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
        console.log('processAudioData: Cleared timer');
      }
      
      // Instead of aborting processing, just don't update UI if component unmounted
      const isComponentMounted = isMountedRef.current;
      if (!isComponentMounted) {
        console.log('processAudioData: Component unmounted, continuing processing but skipping UI updates');
      }
      
      // Update state only if component is mounted
      if (isComponentMounted) {
        updateRecordingState(false);
        setIsProcessing(true);
        console.log('processAudioData: Updated UI state to processing');
      }
      
      // Convert blob to base64
      let base64Audio = '';
      try {
        console.log('processAudioData: Starting blob to base64 conversion');
        base64Audio = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const result = reader.result as string;
              // Extract only the base64 part without the data URL prefix
              const base64 = result.split(',')[1];
              console.log(`processAudioData: Base64 conversion complete, ${base64.length} chars`);
              resolve(base64);
            } catch (error) {
              console.error('processAudioData: Error in FileReader onload:', error);
              reject(error);
            }
          };
          reader.onerror = (event) => {
            console.error('processAudioData: FileReader error:', event);
            reject(new Error('FileReader error during base64 conversion'));
          };
          reader.onabort = () => {
            console.error('processAudioData: FileReader aborted');
            reject(new Error('FileReader aborted during base64 conversion'));
          };
          reader.readAsDataURL(durableBlob);
          console.log('processAudioData: FileReader.readAsDataURL called');
        });
      } catch (err) {
        console.error('processAudioData: Failed to convert audio to base64:', err);
        if (isComponentMounted) {
          cleanupTranscribingUI();
          setError('Failed to process audio');
        }
        return;
      }
      
      // Use the speechToText utility function with the AbortController signal
      try {
        // Set up the AbortController for cancellation
        abortControllerRef.current = new AbortController();
        
        console.log('processAudioData: Calling speechToText utility function');
        
        // Make sure we don't have data: prefix from the FileReader (Replicate API expects raw base64)
        if (base64Audio.includes('data:')) {
          console.log('processAudioData: Found data: prefix in base64, removing it');
          base64Audio = base64Audio.split(',')[1];
        }
        
        // Check base64 format and log info for debugging
        console.log(`processAudioData: Audio format check - length: ${base64Audio.length}, starts with: ${base64Audio.substring(0, 20)}...`);
        
        const text = await speechToText(base64Audio, abortControllerRef.current.signal);
        
        // The predictionId may be handled inside the speechToText function, so we don't set it here
        
        // Cleanup transcribing UI if component is still mounted
        if (isComponentMounted) {
          cleanupTranscribingUI();
        }
        
        // Process the transcribed text
        if (text && text.trim().length > 0) {
          console.log('processAudioData: Transcription successful:', text);
          await processOutput(text);
        } else {
          console.warn('processAudioData: No text detected in transcription');
          if (isComponentMounted) {
            setError('No speech detected');
          }
        }
      } catch (err) {
        console.error('processAudioData: Transcription error:', err);
        if (isComponentMounted) {
          cleanupTranscribingUI();
          setError(`Failed to transcribe: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } catch (err) {
      console.error('processAudioData: Error processing audio:', err);
      if (isMountedRef.current) {
        cleanupTranscribingUI();
        setError(`Error processing audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } finally {
      // Make sure to clean up, regardless of success or failure
      isPredictionPollingRef.current = false;
      predictionIdRef.current = null;
    }
  }
  
  // Add a function to poll for transcription results
  const pollForResult = async (predictionId: string) => {
    try {
      for (let attempt = 0; attempt < 120; attempt++) {
        console.log(`pollForResult: Poll attempt ${attempt + 1}/120`);
        
        // Wait
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check abort
        if (abortControllerRef.current?.signal.aborted) {
          console.log('pollForResult: Aborted by user');
          throw new DOMException('Aborted', 'AbortError');
        }
        
        // Make request
        try {
          console.log(`pollForResult: Sending GET request to Replicate for prediction ${predictionId}`);
          // Use window.electron.proxyReplicate instead of direct fetch
          const response = await window.electron.proxyReplicate({
            url: `https://api.replicate.com/v1/predictions/${predictionId}`,
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${REPLICATE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`pollForResult: Received response`);
          
          if (response.error) {
            console.error(`pollForResult: Error response from API:`, response.error);
            throw new Error(`Poll error: ${response.error}`);
          }
          
          // Check the status
          if (response.status === 'succeeded') {
            console.log(`pollForResult: Prediction successful:`, response.output);
            return response.output;
          } else if (response.status === 'failed') {
            console.error(`pollForResult: Prediction failed:`, response);
            throw new Error(`Transcription failed: ${response.error || 'Unknown error'}`);
          } else if (response.status === 'canceled') {
            console.log(`pollForResult: Prediction was canceled`);
            throw new Error('Transcription was canceled');
          }
          
          console.log(`pollForResult: Status is ${response.status}, continuing to poll`);
        } catch (err: unknown) {
          // If this is an abort error, re-throw it
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw err;
          }
          console.error(`pollForResult: Error during polling:`, err);
          // For other errors, we'll just try again
        }
      }
      
      console.error('pollForResult: Maximum polling attempts reached without success');
      throw new Error('Transcription timed out after 120 attempts');
    } catch (err) {
      console.error('pollForResult: Error polling for result:', err);
      throw err;
    }
  };
  
  // Toggle recording
  async function toggleRecording() {
    console.log(`toggleRecording called, current state: ${isRecording ? 'recording' : 'not recording'}`);
    if (isRecording) {
      console.log('Stopping recording from toggle function');
      if (recorderRef.current) {
        console.log('Recorder exists, calling stop()');
        try {
          // Directly stop the recorder
          recorderRef.current.stop();
          console.log('Recorder stop() called successfully');
          
          // Update UI state (the onStop callback will handle the rest)
          updateRecordingState(false);
        } catch (err) {
          console.error('Error stopping recorder:', err);
          // Clean up if there's an error
          cleanupAudioResources();
        }
      } else {
        console.warn('No recorder reference found');
        cleanupAudioResources();
      }
    } else {
      console.log('Starting recording');
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
        : ''
  } ${className}`;
  
  // No longer need to position an indicator in the editor
  useEffect(() => {
    // The transcribing state is shown in the SpeechButton component itself
    // through the buttonClassName styles and processing icon
  }, [isProcessing]);
  
  // Add a helper function to clean up the transcribing UI
  function cleanupTranscribingUI() {
    if (isMountedRef.current) {
      setIsProcessing(false);
    }
  }
  
  // Helper function to extract text from response
  function extractTextFromResponse(output: any): string {
    try {
      console.log('extractTextFromResponse: Processing output type:', typeof output, output);
      
      // If output is a string, return it directly
      if (typeof output === 'string') {
        console.log('extractTextFromResponse: Found string output:', output);
        return output;
      }
      
      // Check for Whisper specific response format with transcription field
      if (output && typeof output === 'object' && output.transcription) {
        console.log('extractTextFromResponse: Found transcription field:', output.transcription);
        return output.transcription;
      }
      
      // If output is an object with text property (common format)
      if (output && typeof output === 'object' && output.text) {
        console.log('extractTextFromResponse: Found text field:', output.text);
        return output.text;
      }
      
      // If output is an array (some models return array of segments)
      if (Array.isArray(output)) {
        console.log('extractTextFromResponse: Found array output:', output);
        if (output.length > 0) {
          // If array contains objects with text property
          if (output[0] && typeof output[0] === 'object' && output[0].text) {
            const joinedText = output.map((segment: any) => segment.text).join(' ');
            console.log('extractTextFromResponse: Joined text from array of objects:', joinedText);
            return joinedText;
          }
          // If array of strings
          const joinedText = output.join(' ');
          console.log('extractTextFromResponse: Joined text from array of strings:', joinedText);
          return joinedText;
        }
        console.log('extractTextFromResponse: Empty array');
        return '';
      }
      
      // If all else fails, convert to string
      console.log('extractTextFromResponse: Falling back to string conversion:', String(output || ''));
      return String(output || '');
    } catch (e) {
      console.error('Error extracting text from response:', e);
      return String(output || '');
    }
  }

  // Process the transcription output
  async function processOutput(text: string) {
    // Cleanup UI
    cleanupTranscribingUI();
    
    // Trim any leading/trailing whitespace and add a space at the beginning
    const trimmedText = " " + text.trim();
    
    if (trimmedText && trimmedText.length > 1) { // Length should be > 1 because we added a space
      console.log('Successfully transcribed:', trimmedText);
      
      // Hide placeholder text when adding content
      const editorElement = document.getElementById('editor');
      if (editorElement) {
        // Hide placeholder text
        const placeholderElement = document.querySelector('.placeholder-text') as HTMLElement;
        if (placeholderElement) {
          placeholderElement.style.display = 'none';
        }
        
        // Dispatch custom event to notify editor component
        const hidePlaceholderEvent = new CustomEvent('editorContentChanged', { detail: { hasContent: true } });
        editorElement.dispatchEvent(hidePlaceholderEvent);
      }
      
      // Call onTextReceived callback
      onTextReceived(trimmedText);
    } else {
      setError('No speech detected');
    }
  }

  // Dynamic waveform component with randomized heights
  const RecordingWaveform = () => {
    const [heights, setHeights] = useState([15, 8, 12, 7, 10]);
    
    useEffect(() => {
      if (!isRecording) return;
      
      // Create a random waveform animation by periodically updating bar heights
      const interval = setInterval(() => {
        setHeights(prevHeights => 
          prevHeights.map(() => Math.floor(Math.random() * 14) + 4)
        );
      }, 300);
      
      return () => clearInterval(interval);
    }, [isRecording]);
    
    return (
      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-10 h-4 z-10">
        <div className="reactive-waveform">
          {heights.map((height, index) => (
            <div 
              key={index}
              className="waveform-bar" 
              style={{
                height: `${height}px`,
                animation: 'none' // No animation since we're controlling height directly
              }}
            />
          ))}
        </div>
      </div>
    );
  };
  
  // Processing indicator component
  const ProcessingIndicator = () => {
    return (
      <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 z-10">
        <div className="processing-indicator">
          <div className="processing-spinner"></div>
        </div>
      </div>
    );
  };

  // Add a new function to cancel transcription
  const cancelTranscription = () => {
    console.log('cancelTranscription: Cancelling ongoing transcription');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('cancelTranscription: AbortController signaled to abort');
      
      // Also send a cancellation request to the API if we have a prediction ID
      if (predictionIdRef.current) {
        console.log(`cancelTranscription: Sending cancellation for prediction ${predictionIdRef.current}`);
        window.electron.proxyReplicate({
          url: `https://api.replicate.com/v1/predictions/${predictionIdRef.current}/cancel`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }).catch(err => {
          console.error('Error cancelling prediction:', err);
        });
      }
    }
    setIsProcessing(false);
    isPredictionPollingRef.current = false;
    predictionIdRef.current = null;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={isProcessing ? cancelTranscription : toggleRecording}
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
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'visible',
          backgroundColor: isRecording ? 'rgba(239, 68, 68, 0.9)' : '',
          color: isRecording ? 'white' : ''
        }}
      >
        {isProcessing ? (
          <DismissRegular className="w-5 h-5 text-blue-500 processing-icon" />
        ) : isRecording ? (
          <div className="stop-icon" style={{ 
            width: '14px', 
            height: '14px', 
            backgroundColor: 'white',
            borderRadius: '2px',
            margin: '0 auto'
          }} />
        ) : (
          <Mic20Regular className="w-5 h-5" />
        )}
      </button>
      
      {/* Dynamic waveform when recording */}
      {isRecording && <RecordingWaveform />}
      
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
      
      {/* Hidden container for waveform canvas */}
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
        
        /* Waveform animation styles */
        .reactive-waveform {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          height: 100%;
          width: 100%;
          gap: 1px;
        }
        
        .waveform-bar {
          width: 2px;
          background-color: white;
          border-radius: 1px;
          transition: height 0.2s ease;
        }
        
        /* Processing indicator styles */
        .processing-indicator {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .processing-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(59, 130, 246, 0.2);
          border-top-color: rgba(59, 130, 246, 0.9);
          border-radius: 50%;
          animation: spinner 0.8s linear infinite;
        }
        
        @keyframes spinner {
          to {
            transform: rotate(360deg);
          }
        }
        `}
      </style>
    </div>
  );
} 