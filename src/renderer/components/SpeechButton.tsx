import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@fluentui/react-components';
import { MicRegular, MicPulseRegular } from '@fluentui/react-icons';
import { speechToText } from 'utils/util';
import { useTranslation } from 'react-i18next';

// Custom CSS to make the button seamless with chevron
const customStyles = {
  button: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRight: 'none',
    position: 'relative' as const,
  }
};

interface SpeechButtonProps {
  onTextReceived: (text: string) => void;
  onRecordingStateChange?: (recording: boolean) => void;
  disabled?: boolean;
  className?: string;
  appTheme?: 'light' | 'dark';
}

export default function SpeechButton({
  onTextReceived,
  onRecordingStateChange,
  disabled = false,
  className = '',
  appTheme = 'light'
}: SpeechButtonProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);
  
  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
  
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          // Extract only the data part
          const base64Audio = base64data.split(',')[1];
          
          try {
            const text = await speechToText(base64Audio);
            onTextReceived(text);
          } catch (error) {
            console.error('Speech recognition error:', error);
          }
        };
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Update state
        setIsRecording(false);
        if (onRecordingStateChange) {
          onRecordingStateChange(false);
        }
      };
      
      // Start recording
      mediaRecorderRef.current.start();
      setIsRecording(true);
      if (onRecordingStateChange) {
        onRecordingStateChange(true);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }
  
  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }
  
  return (
    <Button
      icon={isRecording ? <MicPulseRegular /> : <MicRegular />}
      disabled={disabled}
      onClick={toggleRecording}
      title={t('Common.VoiceInput')}
      className={className}
      style={customStyles.button}
      appearance="subtle"
    />
  );
} 