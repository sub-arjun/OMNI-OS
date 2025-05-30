import { Button, Spinner, Tooltip } from '@fluentui/react-components';
import {
  bundleIcon,
  SpeakerMute24Filled,
  SpeakerMute24Regular,
  Speaker224Filled,
  Speaker224Regular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import { textToSpeech } from '../../utils/util';
import useToast from '../../hooks/useToast';
import useProvider from '../../hooks/useProvider';
import useSettingsStore from '../../stores/useSettingsStore';

// Create bundled icons for speaker
const SpeakerIcon = bundleIcon(Speaker224Filled, Speaker224Regular);
const MuteIcon = bundleIcon(SpeakerMute24Filled, SpeakerMute24Regular);

// Global audio player state
let currentAudio: HTMLAudioElement | null = null;
let currentButtonId: string | null = null;

// CSS for the waveform animation and button glow
const waveformStyle = `
.waveform-container {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 15px;
  margin-top: 2px;
  width: 32px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -18px;
  gap: 1px;
}

.waveform-bar {
  background-color: var(--colorBrandForeground1);
  width: 2px;
  margin: 0 1px;
  height: 3px;
  border-radius: 1px;
  animation: waveform-animation 1s infinite ease-in-out;
}

.waveform-bar:nth-child(1) { animation-delay: 0.0s; }
.waveform-bar:nth-child(2) { animation-delay: 0.1s; }
.waveform-bar:nth-child(3) { animation-delay: 0.2s; }
.waveform-bar:nth-child(4) { animation-delay: 0.3s; }
.waveform-bar:nth-child(5) { animation-delay: 0.4s; }
.waveform-bar:nth-child(6) { animation-delay: 0.5s; }
.waveform-bar:nth-child(7) { animation-delay: 0.15s; }

@keyframes waveform-animation {
  0%, 100% { height: 3px; }
  50% { height: 10px; }
}

.tts-button-active {
  background-color: rgba(255, 59, 48, 0.1) !important;
  border-color: rgba(255, 59, 48, 0.3) !important;
  animation: tts-pulse 2s infinite;
  box-shadow: 0 0 8px rgba(255, 59, 48, 0.5);
  color: rgb(255, 59, 48) !important;
}

@keyframes tts-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(255, 59, 48, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
  }
}
`;

export default function TTSButton({ 
  message, 
  id 
}: { 
  message: string,
  id: string
}) {
  const { t } = useTranslation();
  const { notifyError, notifyInfo } = useToast();
  
  // Get current provider to check if we're using OMNI Edge
  const { api } = useSettingsStore.getState();
  const { getProvider } = useProvider();
  const currentProvider = getProvider(api.provider);
  const isOllamaProvider = currentProvider.name === 'Ollama';
  
  // State to track loading and playing status
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Ref to store audio URL once generated
  const audioUrlRef = useRef<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Handle audio ended event
  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    if (audioElementRef.current) {
      audioElementRef.current.removeEventListener('ended', handleAudioEnded);
    }
    audioElementRef.current = null;
    if (currentButtonId === id) {
      currentAudio = null;
      currentButtonId = null;
    }
    
    // Clean up blob URL if it exists
    if (audioUrlRef.current && audioUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, [id]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (audioElementRef.current && currentButtonId === id) {
        audioElementRef.current.pause();
        audioElementRef.current.removeEventListener('ended', handleAudioEnded);
        currentAudio = null;
        currentButtonId = null;
      }
      
      // Clean up blob URL on unmount
      if (audioUrlRef.current && audioUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [id, handleAudioEnded]);
  
  useEffect(() => {
    // Add style element for waveform
    const styleEl = document.createElement('style');
    styleEl.innerHTML = waveformStyle;
    document.head.appendChild(styleEl);

    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  
  const togglePlay = async () => {
    // If Ollama provider, show not supported message and return
    if (isOllamaProvider) {
      notifyInfo(t('Common.NotSupported.TTS.OllamaProvider', 'Text-to-speech is not supported with OMNI Edge'));
      return;
    }
    
    // If currently playing, stop playback
    if (isPlaying) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.removeEventListener('ended', handleAudioEnded);
        setIsPlaying(false);
        if (currentButtonId === id) {
          currentAudio = null;
          currentButtonId = null;
        }
      }
      return;
    }
    
    // If another audio is playing, stop it first
    if (currentAudio && currentButtonId !== id) {
      currentAudio.pause();
      currentAudio = null;
      // Find and reset the button state for the previous audio
      const prevButton = document.querySelector(`[data-tts-id="${currentButtonId}"]`);
      if (prevButton) {
        // This will be picked up by the React state management of the other component
        prevButton.setAttribute('data-playing', 'false');
      }
      currentButtonId = null;
    }
    
    // If we already have the audio URL, play it
    if (audioUrlRef.current) {
      const audio = new Audio(audioUrlRef.current);
      audio.addEventListener('ended', handleAudioEnded);
      audio.play().catch(error => {
        notifyError(t('Common.Error.AudioPlayback'));
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      });
      
      setIsPlaying(true);
      audioElementRef.current = audio;
      currentAudio = audio;
      currentButtonId = id;
      return;
    }
    
    // Otherwise, generate the speech
    setIsLoading(true);
    try {
      const audioUrl = await textToSpeech(message);
      audioUrlRef.current = audioUrl;
      
      // Play the audio
      const audio = new Audio(audioUrl);
      audio.addEventListener('ended', handleAudioEnded);
      audio.play().catch(error => {
        notifyError(t('Common.Error.AudioPlayback'));
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      });
      
      setIsPlaying(true);
      audioElementRef.current = audio;
      currentAudio = audio;
      currentButtonId = id;
    } catch (error) {
      console.error('Error generating speech:', error);
      notifyError(t('Common.Error.SpeechGeneration'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render waveform when playing
  const renderWaveform = () => {
    if (!isPlaying) return null;
    
    return (
      <div className="waveform-container">
        <div className="waveform-bar"></div>
        <div className="waveform-bar"></div>
        <div className="waveform-bar"></div>
        <div className="waveform-bar"></div>
        <div className="waveform-bar"></div>
        <div className="waveform-bar"></div>
        <div className="waveform-bar"></div>
      </div>
    );
  };

  return (
    <div className="relative">
      <Tooltip content={isOllamaProvider ? t('Common.NotSupported.TTS', 'Text-to-speech not supported') : (isPlaying ? t('Common.StopSpeech') : t('Common.PlaySpeech'))} relationship="label">
        <Button
          data-tts-id={id}
          data-playing={isPlaying ? 'true' : 'false'}
          size="small"
          icon={isLoading ? <Spinner size="tiny" /> : (isPlaying ? <MuteIcon /> : <SpeakerIcon />)}
          appearance="subtle"
          onClick={togglePlay}
          disabled={isLoading || isOllamaProvider}
          className={isPlaying ? 'tts-button-active' : ''}
          aria-label={isOllamaProvider ? t('Common.NotSupported.TTS') : (isPlaying ? t('Common.StopSpeech') : t('Common.PlaySpeech'))}
        />
      </Tooltip>
      {renderWaveform()}
    </div>
  );
} 