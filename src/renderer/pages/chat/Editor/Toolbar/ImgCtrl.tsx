import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  InputOnChangeData,
  Radio,
  RadioGroup,
  makeStyles,
  Text,
  Tooltip
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  ImageAdd20Regular,
  ImageAdd20Filled,
  Dismiss24Regular,
  LinkSquare20Regular,
  ArrowUpload24Regular,
  CameraRegular,
  Camera24Regular,
  Record24Regular,
} from '@fluentui/react-icons';

import { IChat, IChatContext } from 'intellichat/types';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isBlank } from 'utils/validators';
import { isWebUri } from 'valid-url';
import { insertAtCursor } from 'utils/util';
import useChatStore from 'stores/useChatStore';
import ClickAwayListener from 'renderer/components/ClickAwayListener';
import React from 'react';

const ImageAddIcon = bundleIcon(ImageAdd20Filled, ImageAdd20Regular);

// Define styles outside the component
const useStyles = makeStyles({
  uploadArea: {
    border: '2px dashed #ccc',
    borderRadius: '4px',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: '10px',
    minHeight: '150px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorMessage: {
    color: 'var(--colorStatusDangerForeground1)',
    marginTop: '8px'
  },
  webcamContainer: {
    position: 'relative',
    width: '100%',
    minHeight: '250px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  webcamVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  webcamCapture: {
    position: 'absolute',
    bottom: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    backgroundColor: 'var(--colorBrandBackground)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
  },
  webcamPreview: {
    width: '100%',
    height: 'auto',
    borderRadius: '4px',
    marginBottom: '10px',
  }
});

// Safe utility to stop media streams
function stopMediaStream(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach(track => {
      if (track.readyState === 'live') {
        track.stop();
      }
    });
  }
}

// Define props type explicitly
type ImgCtrlProps = {
  ctx: IChatContext;
  chat: IChat;
};

// Simple function component
export default function ImgCtrl({ ctx, chat }: ImgCtrlProps) {
  // Core hooks
  const { t } = useTranslation();
  const styles = useStyles();
  const editStage = useChatStore((state) => state.editStage);
  
  // Get model
  const model = ctx.getModel();
  
  // Core state
  const [open, setOpen] = useState(false);
  const [imgType, setImgType] = useState('file');
  const [imgURL, setImgURL] = useState('');
  const [imgBase64, setImgBase64] = useState('');
  const [imgName, setImgName] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [webcamState, setWebcamState] = useState({
    active: false,
    hasPermission: true
  });
  
  // Refs
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  
  // Static values
  const visionEnabled = !!model?.vision?.enabled;
  
  // Debug: log dialog and image-type changes
  useEffect(() => {
    console.log('[ImgCtrl] open:', open, 'imgType:', imgType, 'imgBase64 set?', !!imgBase64);
  }, [open, imgType, imgBase64]);
  
  // Debug: log when image type radio changes
  const debugHandleTypeChange = useCallback((_: any, data: any) => {
    console.log('[ImgCtrl] handleTypeChange ->', data.value);
    setImgType(data.value);
    setErrMsg('');
    setImgBase64('');
  }, []);
  
  // Initialize component
  useEffect(() => {
    // Set mounted flag
    mountedRef.current = true;
    
    // Setup keyboard shortcut
    if (visionEnabled) {
      Mousetrap.bind('ctrl+shift+7', () => setOpen(true));
      
      // Set initial image type based on model capabilities
      const allowUrl = model?.vision?.allowUrl;
      const allowBase64 = model?.vision?.allowBase64;
      if (allowUrl && !allowBase64) {
        setImgType('url');
      } else {
        setImgType('file');
      }
    }
    
    // Clean up on unmount
    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        stopMediaStream(streamRef.current);
        streamRef.current = null;
      }
      Mousetrap.unbind('ctrl+shift+7');
      Mousetrap.unbind('esc');
    };
  }, [visionEnabled, model?.vision]);
  
  // Handle dialog state
  useEffect(() => {
    if (open) {
      Mousetrap.bind('esc', () => setOpen(false));
    } else {
      Mousetrap.unbind('esc');
      // Stop webcam when dialog closes
      stopWebcam();
    }
  }, [open]);
  
  // Handle webcam state
  useEffect(() => {
    if (open && imgType === 'webcam' && !imgBase64) {
      startWebcam();
    } else if (imgType !== 'webcam' || !open) {
      stopWebcam();
    }
  }, [open, imgType, imgBase64]);
  
  // Start webcam safely
  const startWebcam = useCallback(async () => {
    console.log('[ImgCtrl] startWebcam called');
    // Clean up any existing stream first
    stopWebcam();
    
    if (!navigator.mediaDevices) {
      setWebcamState(prev => ({ ...prev, hasPermission: false }));
      setErrMsg(t('Webcam access is not available in this browser.'));
      return;
    }
    
    // Check Windows camera permission
    const status = await window.electron.getMediaAccessStatus('camera');
    if (status !== 'granted') {
      setWebcamState(prev => ({ ...prev, hasPermission: false }));
      setErrMsg(t('Camera access was denied. Please enable access in Windows Settings.'));
      await window.electron.openExternal('ms-settings:privacy-webcam');
      return;
    }
    
    console.log('[ImgCtrl] Secure context:', window.isSecureContext, 'mediaDevices:', !!navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    }).then(stream => {
      if (!mountedRef.current) {
        stopMediaStream(stream);
        return;
      }
      
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        streamRef.current = stream;
        setWebcamState({ active: true, hasPermission: true });
        setErrMsg('');
      } else {
        stopMediaStream(stream);
      }
    }).catch(error => {
      console.error('Error accessing webcam:', error);
      if (mountedRef.current) setErrMsg(`Webcam error: ${error.name} - ${error.message}`);
      if (mountedRef.current) {
        setWebcamState(prev => ({ ...prev, hasPermission: false }));
        
        // Handle specific error types more gracefully
        if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          // This typically happens when the camera is already in use by another application
          setErrMsg(t('Camera is already in use by another application. Please close other applications using the camera and try again.'));
        } else if (error.name === 'NotFoundError') {
          setErrMsg(t('No camera was found on your device.'));
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setErrMsg(t('Camera access was denied. Please allow access to use this feature.'));
        } else {
        setErrMsg(t('Could not access webcam. Please check permissions.'));
        }
      }
    });
  }, [t]);
  
  // Stop webcam safely
  const stopWebcam = useCallback(() => {
    if (webcamRef.current && webcamRef.current.srcObject) {
      stopMediaStream(webcamRef.current.srcObject as MediaStream);
      webcamRef.current.srcObject = null;
    }
    
    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
    
    if (mountedRef.current) {
      setWebcamState(prev => ({ ...prev, active: false }));
    }
  }, []);
  
  // Capture image from webcam
  const captureImage = useCallback(() => {
    if (!webcamRef.current || !canvasRef.current || !webcamRef.current.videoWidth) {
      return;
    }
    
    const video = webcamRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/png');
      
      if (mountedRef.current) {
        setImgBase64(imageData);
        setImgName('webcam-capture.png');
        setErrMsg('');
        stopWebcam();
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      if (mountedRef.current) {
        setErrMsg(t('Failed to capture image from webcam.'));
      }
    }
  }, [stopWebcam, t]);
  
  // Handle file selection
  const handleSelectImage = useCallback(async () => {
    try {
      const dataString = await window.electron.selectImageWithBase64();
      if (!dataString || !mountedRef.current) return;
      
      const file = JSON.parse(dataString);
      if (file.name && file.base64) {
        setImgName(file.name);
        setImgBase64(file.base64);
        setErrMsg('');
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      if (mountedRef.current) {
        setErrMsg(t('Please input a valid image.'));
      }
    }
  }, [t]);
  
  // Handle URL input change
  const handleUrlChange = useCallback((ev: ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => {
    setImgURL(data.value);
  }, []);
  
  // Add image to editor
  const addImage = useCallback(() => {
    let url = null;
    
    if (imgURL) {
      if (!isWebUri(imgURL) && !imgURL.startsWith('data:')) {
        setErrMsg(t('Please input a valid image URL or base64 string.'));
        return;
      }
      url = imgURL;
    } else if (imgBase64) {
      url = imgBase64;
    }
    
    if (!url) return;
    
    const editor = document.querySelector('#editor') as HTMLDivElement;
    if (!editor) return;
    
    editStage(chat.id, {
      input: insertAtCursor(
        editor,
        `<img src="${url}" style="width:260px; display:block;" />`
      ),
    });
    
    // Reset state
    setOpen(false);
    setImgURL('');
    setImgBase64('');
    setImgName('');
    editor.focus();
  }, [chat.id, editStage, imgBase64, imgURL, t]);
  
  // Cancel dialog
  const handleCancel = useCallback(() => {
    setOpen(false);
    setImgURL('');
    setImgBase64('');
    setImgName('');
    setErrMsg('');
  }, []);
  
  // Change image type
  const handleTypeChange = debugHandleTypeChange;
  
  // Reset webcam
  const handleRetakePhoto = useCallback(() => {
    setImgBase64('');
    startWebcam();
  }, [startWebcam]);
  
  // Handle drag-drop prevention
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setErrMsg(t('Please click to select an image file.'));
  }, [t]);
  
  // Memoized add button state
  const isAddBtnDisabled = useMemo(() => {
    return isBlank(imgURL) && isBlank(imgBase64);
  }, [imgURL, imgBase64]);
  
  // Memoized URL input
  const urlInputElement = useMemo(() => (
    <Input
      value={imgURL}
      type="url"
      contentBefore={<LinkSquare20Regular />}
      id="image-url-input"
      className="w-full"
      onChange={handleUrlChange}
    />
  ), [imgURL, handleUrlChange]);
  
  // Memoized file input
  const fileInputElement = useMemo(() => (
    <div>
      <div 
        id="upload-area"
        className={styles.uploadArea} 
        onClick={handleSelectImage}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        tabIndex={0}
      >
        <ArrowUpload24Regular />
        <Text>
          {imgName 
            ? imgName 
            : t('Common.SelectImage') + " - " + t('Common.Image') + " (jpg, png, jpeg)"}
        </Text>
      </div>
      {errMsg && <Text className={styles.errorMessage}>{errMsg}</Text>}
    </div>
  ), [styles, handleSelectImage, handleDrop, imgName, errMsg, t]);
  
  // Memoized webcam input
  const webcamInputElement = useMemo(() => (
    <div>
      {!imgBase64 ? (
        <div className={styles.webcamContainer}>
          {webcamState.hasPermission ? (
            <>
              <video 
                ref={webcamRef}
                className={styles.webcamVideo}
                autoPlay
                playsInline
                muted
              />
              {webcamState.active && (
                <button 
                  className={styles.webcamCapture}
                  onClick={captureImage}
                  title={t('Capture Photo')}
                >
                  <Record24Regular />
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <Camera24Regular className="mb-2 text-gray-400" />
              <Text>{t('Please allow camera access to use this feature.')}</Text>
            </div>
          )}
        </div>
      ) : (
        <div>
          <img 
            src={imgBase64} 
            alt="Captured" 
            className={styles.webcamPreview} 
          />
          <Button 
            appearance="secondary"
            onClick={handleRetakePhoto}
          >
            {t('Take Another Photo')}
          </Button>
        </div>
      )}
      {errMsg && <Text className={styles.errorMessage}>{errMsg}</Text>}
      
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  ), [styles, webcamState, imgBase64, captureImage, handleRetakePhoto, errMsg, t]);
  
  // Early return if vision is not enabled
  if (!visionEnabled) {
    return null;
  }
  
  // Render the component
  return (
    <ClickAwayListener onClickAway={() => open && setOpen(false)} active={open}>
      <Dialog open={open}>
        <DialogTrigger disableButtonEnhancement>
          <Tooltip
            content={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Image')}</div>
                <div>Attach an image to the chat (Ctrl+Shift+7)</div>
              </div>
            }
            relationship="description"
            positioning="before"
          >
            <Button
              size="small"
              title="Ctrl+Shift+7"
              aria-label={t('Common.Image')}
              appearance="subtle"
              icon={<ImageAddIcon />}
              className="justify-start"
              onClick={() => setOpen(true)}
              style={{ 
                borderColor: 'transparent', 
                boxShadow: 'none', 
                padding: 0,
                height: '32px',
                width: '32px',
                minWidth: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          </Tooltip>
        </DialogTrigger>
        <DialogSurface aria-labelledby="add image">
          <DialogBody>
            <DialogTitle
              action={
                <DialogTrigger action="close">
                  <Button
                    appearance="subtle"
                    aria-label="close"
                    onClick={() => setOpen(false)}
                    icon={<Dismiss24Regular />}
                  />
                </DialogTrigger>
              }
            >
              {t('Editor.Toolbar.AddImage')}
            </DialogTitle>
            <DialogContent>
              <div className="w-full mb-5">
                <Field>
                  <RadioGroup
                    layout="horizontal"
                    value={imgType}
                    onChange={handleTypeChange}
                  >
                    <Radio value="file" label="File" />
                    <Radio value="url" label="URL" />
                    <Radio value="webcam" label="Camera" />
                  </RadioGroup>
                </Field>

                <div className="mt-2">
                  <Field>
                    {imgType === 'url' 
                      ? urlInputElement
                      : imgType === 'file' 
                      ? fileInputElement
                      : webcamInputElement}
                  </Field>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button
                  appearance="subtle"
                  onClick={handleCancel}
                >
                  {t('Common.Cancel')}
                </Button>
              </DialogTrigger>
              <Button
                appearance="primary"
                disabled={isAddBtnDisabled}
                onClick={addImage}
              >
                {t('Add')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </ClickAwayListener>
  );
}
