import { captureException } from '../../logging';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Spinner from 'renderer/components/Spinner';

interface IUpdateInfo {
  version?: string;
  releaseNotes?: string;
  releaseName?: string;
  isChecking?: boolean;
  isDownloading?: boolean;
  isDownloaded?: boolean;
  isAvailable?: boolean;
  error?: string;
  downloadProgress?: {
    percent: number;
    transferred: number;
    total: number;
    bytesPerSecond: number;
  };
}

export default function Version() {
  const { t } = useTranslation();

  const [updateInfo, setUpdateInfo] = useState<IUpdateInfo>();
  const [version, setVersion] = useState('0');
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timer | null = null;
    
    const initializeUpdateInfo = async () => {
      const updateInfo = await window.electron.store.get('updateInfo');
      setUpdateInfo(updateInfo);
      
      if (updateInfo?.isDownloading || updateInfo?.isChecking) {
        timer = setInterval(async () => {
          const currentUpdateInfo = await window.electron.store.get('updateInfo');
          if (timer && !currentUpdateInfo?.isDownloading && !currentUpdateInfo?.isChecking) {
            clearInterval(timer);
          }
          setUpdateInfo(currentUpdateInfo);
        }, 1000);
      }
    };

    // Listen for update events
    const handleUpdateReady = (updateData: any) => {
      setUpdateInfo(prev => ({
        ...prev,
        ...updateData,
        isDownloaded: true,
        isDownloading: false
      }));
    };

    const unsubscribeUpdateReady = (window.electron as any).ipcRenderer.on('update-ready', handleUpdateReady);

    initializeUpdateInfo();

    window.electron
      .getAppVersion()
      .then((appVersion) => {
        return setVersion(appVersion);
      })
      .catch(captureException);

    return () => {
      if (timer) {
        clearInterval(timer);
      }
      unsubscribeUpdateReady();
    };
  }, []);

  const handleInstallUpdate = async () => {
    setIsInstalling(true);
    try {
      await (window.electron as any).ipcRenderer.invoke('quit-and-install-update');
    } catch (error) {
      captureException(error as Error);
      setIsInstalling(false);
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      await (window.electron as any).ipcRenderer.invoke('check-for-updates');
    } catch (error) {
      captureException(error as Error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  return (
    <div className="settings-section">
      <div className="settings-section--header">{t('Common.Version')}</div>
      <div className="py-5 flex-grow">
        <div className="flex items-center gap-2">
          <span>{version}</span>
          {!updateInfo?.isAvailable && !updateInfo?.isChecking && (
            <button
              onClick={handleCheckForUpdates}
              className="text-sm text-blue-500 hover:text-blue-700 underline"
            >
              Check for updates
            </button>
          )}
        </div>

        {updateInfo && (
          <div className="mt-4">
            {updateInfo.isChecking && (
              <div className="flex justify-start gap-2 items-center">
                <Spinner size={16} />
                <span className="text-sm text-gray-600">Checking for updates...</span>
              </div>
            )}

            {updateInfo.error && (
              <div className="text-red-500 text-sm">
                <div className="font-medium">Update Error:</div>
                <div>{updateInfo.error}</div>
                <button
                  onClick={handleCheckForUpdates}
                  className="mt-1 text-blue-500 hover:text-blue-700 underline"
                >
                  Try again
                </button>
              </div>
            )}

            {updateInfo.isDownloading && updateInfo.downloadProgress && (
              <div className="space-y-2">
                <div className="flex justify-start gap-2 items-center">
                  <Spinner size={16} />
                  <span className="text-sm text-gray-600">
                    Downloading update v{updateInfo.version}...
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${updateInfo.downloadProgress.percent}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  {updateInfo.downloadProgress.percent}% • {' '}
                  {formatBytes(updateInfo.downloadProgress.transferred)} / {' '}
                  {formatBytes(updateInfo.downloadProgress.total)} • {' '}
                  {formatSpeed(updateInfo.downloadProgress.bytesPerSecond)}
                </div>
              </div>
            )}

            {updateInfo.isDownloaded && !isInstalling && (
              <div className="space-y-2">
                <div className="text-green-600 font-medium">
                  Update v{updateInfo.version} ready to install
                </div>
                {updateInfo.releaseNotes && (
                  <div className="text-sm text-gray-600 max-h-32 overflow-y-auto">
                    <div className="font-medium mb-1">Release Notes:</div>
                    <div className="whitespace-pre-wrap">{updateInfo.releaseNotes}</div>
                  </div>
                )}
                <button
                  onClick={handleInstallUpdate}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded text-sm"
                >
                  Install and Restart
                </button>
              </div>
            )}

            {isInstalling && (
              <div className="flex justify-start gap-2 items-center">
                <Spinner size={16} />
                <span className="text-sm text-gray-600">Installing update...</span>
              </div>
            )}

            {updateInfo.isAvailable && !updateInfo.isDownloading && !updateInfo.isDownloaded && !updateInfo.error && (
              <div className="text-blue-600">
                Update v{updateInfo.version} is available and will be downloaded shortly.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
