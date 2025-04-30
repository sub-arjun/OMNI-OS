import { Button, Spinner, ProgressBar } from '@fluentui/react-components';
import {
  CheckmarkCircle16Filled,
  CheckmarkCircle20Filled,
} from '@fluentui/react-icons';
import useToast from 'hooks/useToast';
import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from 'renderer/components/ConfirmDialog';
import Debug from 'debug';

const debug = Debug('5ire:pages:settings:EmbedSettings');

const FILES = [
  {
    name: 'config.json',
    url: 'https://huggingface.co/Xenova/bge-m3/resolve/main/config.json?download=true',
  },
  {
    name: 'tokenizer_config.json',
    url: 'https://huggingface.co/Xenova/bge-m3/resolve/main/tokenizer_config.json?download=true',
  },
  {
    name: 'tokenizer.json',
    url: 'https://huggingface.co/Xenova/bge-m3/resolve/main/tokenizer.json?download=true',
  },
  {
    name: 'model_quantized.onnx',
    url: 'https://huggingface.co/Xenova/bge-m3/resolve/main/onnx/model_quantized.onnx?download=true',
  },
];

export default function EmbedSettings() {
  const model = 'Xenova/bge-m3';
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const [delConfirmDialogOpen, setDelConfirmDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [fileStatus, setFileStatus] = useState<{ [key: string]: boolean }>({
    'model_quantized.onnx': false,
    'config.json': false,
    'tokenizer_config.json': false,
    'tokenizer.json': false,
  });
  const [downloading, setDownloading] = useState<{ [key: string]: boolean }>({
    'model_quantized.onnx': false,
    'config.json': false,
    'tokenizer_config.json': false,
    'tokenizer.json': false,
  });
  const [progress, setProgress] = useState<{ [key: string]: number }>({
    'model_quantized.onnx': 0,
    'config.json': 0,
    'tokenizer_config.json': 0,
    'tokenizer.json': 0,
  });
  const [downloadError, setDownloadError] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const embeddingModelFileName = 'model_quantized.onnx';

  // Track overall downloading state from individual file states
  const isDownloading = useMemo(() => {
    return Object.values(downloading).some((item) => item);
  }, [downloading]);

  const isModelReady = useMemo(() => {
    return Object.values(fileStatus).every((item) => item);
  }, [fileStatus]);

  // Define the missing loadModelStatus function
  const loadModelStatus = async () => {
    try {
      if (window.electron?.embeddings?.getModelFileStatus) {
        const status = await window.electron.embeddings.getModelFileStatus();
        setFileStatus({
          'model_quantized.onnx': status['model_quantized.onnx'] || false,
          'config.json': status['config.json'] || false,
          'tokenizer_config.json': status['tokenizer_config.json'] || false,
          'tokenizer.json': status['tokenizer.json'] || false,
        });
        return status;
      }
    } catch (error) {
      console.error('Error checking model status:', error);
    }
    return {};
  };

  useEffect(() => {
    if (!Object.values(downloading).some((item) => item)) {
      setCancelling(false);
    }
  }, [downloading]);

  useEffect(() => {
    loadModelStatus();
    
    // Store the cleanup functions returned by 'on'
    const cleanupDownloadStarted = window.electron.ipcRenderer.on(
      'download-started',
      (fileName: unknown) => {
        if (fileName === embeddingModelFileName) {
          setDownloading(prev => ({...prev, [embeddingModelFileName]: true}));
          setDownloadProgress(0);
          setDownloadError('');
        }
      },
    );
    const cleanupDownloadProgress = window.electron.ipcRenderer.on(
      'download-progress',
      (fileName: unknown, progress: unknown) => {
        if (fileName === embeddingModelFileName) {
          setDownloadProgress(progress as number);
        }
      },
    );
    const cleanupDownloadCompleted = window.electron.ipcRenderer.on(
      'download-completed',
      async (fileName: unknown, savePath: unknown) => {
        const name = fileName as string;
        // Mark this file as no longer downloading
        setDownloading(prev => ({ ...prev, [name]: false }));
        // Set progress to 100% for this file
        setProgress(prev => ({ ...prev, [name]: 1 }));
        try {
          if (window.electron?.embeddings?.saveModelFile) {
            await window.electron.embeddings.saveModelFile(name, savePath as string);
            // After saving, refresh all status flags
            await loadModelStatus();
          } else {
            throw new Error('Electron embeddings API not available.');
          }
        } catch (error: any) {
          console.error(`Error saving embedding model file ${name}:`, error);
          setDownloadError(`Failed to save ${name}: ${error.message}`);
        }
      },
    );
    const cleanupDownloadFailed = window.electron.ipcRenderer.on(
      'download-failed',
      (fileName: unknown, savePath: unknown, state: unknown) => {
        if (fileName === embeddingModelFileName) {
          setDownloading(prev => ({...prev, [embeddingModelFileName]: false}));
          setDownloadError(`Download failed: ${state}`);
          console.error('Download failed:', state, savePath);
        }
      },
    );

    return () => {
      // Call the specific cleanup functions
      cleanupDownloadStarted();
      cleanupDownloadProgress();
      cleanupDownloadCompleted();
      cleanupDownloadFailed();
    };
  }, []); // Remove loadModelStatus from dependencies to avoid circular dependency

  function downloadModel() {
    setProgress({
      'model_quantized.onnx': 0,
      'config.json': 0,
      'tokenizer_config.json': 0,
      'tokenizer.json': 0,
    });
    setDownloading({
      'model_quantized.onnx': true,
      'config.json': true,
      'tokenizer_config.json': true,
      'tokenizer.json': true,
    });
    FILES.forEach((item: any) => {
      window.electron.download(item.name, item.url);
    });
  }

  function cancelDownload() {
    setCancelling(true);
    for (const item of FILES) {
      window.electron.cancelDownload(item.name);
    }
    removeModel();
  }

  function removeModel() {
    window.electron.embeddings.removeModel().then(() => {
      setFileStatus({
        'model_quantized.onnx': false,
        'config.json': false,
        'tokenizer_config.json': false,
        'tokenizer.json': false,
      });
    });
  }

  return (
    <div className="settings-section">
      <div className="settings-section--header">
        {t('Common.Embeddings')}
      </div>
      <div className="py-4 flex-grow mt-1">
        <div className="flex justify-between items-start">
          <div className="mr-2">
            <div className="flex flex-start items-center gap-2">
              <span>{t('Common.Model')}: </span>
              <span>{model}</span>
              {isModelReady && (
                <CheckmarkCircle20Filled className="text-green-500" />
              )}
            </div>
            <div className="tips mt-2 mb-2">
              {isModelReady
                ? t('Settings.Embeddings.Tip.ModelExists')
                : t('Settings.Embeddings.Tip.ModelRequired')}
            </div>
            <div>
              {isModelReady ||
                (isDownloading
                  ? FILES.map((file) => (
                      <div
                        className="flex justify-start items-center gap-2 py-1"
                        key={file.name}
                      >
                        <div>{file.name}</div>
                        {cancelling ? (
                          <span className="text-gray-500">
                            {t('Common.Cancelling')}...
                          </span>
                        ) : downloading[file.name] ? (
                          progress[file.name] ? (
                            <ProgressBar
                              value={progress[file.name]}
                              className="w-32"
                            />
                          ) : (
                            <Spinner
                              size="extra-tiny"
                              className="flex-shrink-0"
                            />
                          )
                        ) : (
                          fileStatus[file.name] && (
                            <CheckmarkCircle16Filled className="text-green-500" />
                          )
                        )}
                      </div>
                    ))
                  : null)}
            </div>
          </div>
          {isModelReady ? (
            <Button
              appearance="subtle"
              size="small"
              onClick={() => setDelConfirmDialogOpen(true)}
            >
              {t('Common.Delete')}
            </Button>
          ) : isDownloading ? (
            <Button
              disabled={cancelling}
              appearance="subtle"
              icon={<Spinner size="extra-tiny" className="flex-shrink-0" />}
              size="small"
              onClick={cancelDownload}
            >
              <span>
                {cancelling ? t('Common.Cancelling') : t('Common.Cancel')}
              </span>
            </Button>
          ) : (
            <Button appearance="primary" size="small" onClick={downloadModel}>
              {t('Common.Download')}
            </Button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={delConfirmDialogOpen}
        setOpen={setDelConfirmDialogOpen}
        message={t('Settings.Embeddings.Confirmation.DeleteModel')}
        onConfirm={() => {
          removeModel();
          notifySuccess(t('Settings.Embeddings.Notification.ModelDeleted'));
        }}
      />
    </div>
  );
}
