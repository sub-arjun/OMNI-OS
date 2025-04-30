import * as logging from './logging';
import Debug from 'debug';
import FluentApp from './components/FluentApp';
import useAuthStore from 'stores/useAuthStore';
import { useEffect } from 'react';
import useToast from 'hooks/useToast';
import { useTranslation } from 'react-i18next';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useMCPStore from 'stores/useMCPStore';
import Mousetrap from 'mousetrap';
import './i18n';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { initSuppressResizeObserverErrors } from '../utils/suppressResizeObserverErrors';
import useSettingsStore from 'stores/useSettingsStore';

// Apply ResizeObserver suppression immediately, before anything else
initSuppressResizeObserverErrors();

import './App.scss';
import './fluentui.scss';

if (window.envVars.NODE_ENV === 'development') {
  Debug.enable('OMNI:*');
}

const debug = Debug('OMNI:App');

logging.init();

// We've already called initSuppressResizeObserverErrors above,
// so this is just to ensure it's always initialized

export default function App() {
  const loadAuthData = useAuthStore((state) => state.load);
  const setSession = useAuthStore((state) => state.setSession);
  const { loadConfig, updateLoadingState } = useMCPStore();
  const { onAuthStateChange } = useAuthStore();
  const { notifyError } = useToast();
  const { t } = useTranslation();
  const { createFile } = useKnowledgeStore();
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  useEffect(() => {
    // Apply suppression again in case our component mounts after some errors occurred
    initSuppressResizeObserverErrors();
    
    // Load settings from electron-store asynchronously
    loadSettings(); 
    
    loadAuthData();
    Mousetrap.prototype.stopCallback = () => {
      return false;
    };
    const subscription = onAuthStateChange();
    window.electron.mcp.init();

    // Store cleanup functions returned by 'on'
    const cleanupMcpServerLoaded = window.electron.ipcRenderer.on(
      'mcp-server-loaded',
      async (serverNames: any) => {
        debug('🚩 MCP Server Loaded:', serverNames);
        loadConfig(true);
        updateLoadingState(false);
      },
    );
    const cleanupSignIn = window.electron.ipcRenderer.on('sign-in', async (authData: any) => {
      if (authData.accessToken && authData.refreshToken) {
        const { error } = await setSession(authData);
        if (error) {
          notifyError(error.message);
        }
      } else {
        debug('🚩 Invalid Auth Data:', authData);
        notifyError(t('Auth.Notification.LoginCallbackFailed'));
      }
    });
    
    const cleanupKnowledgeImport = window.electron.ipcRenderer.on(
      'knowledge-import-success',
      (data: unknown) => {
        const { collectionId, file, numOfChunks } = data as any;
        createFile({
          id: file.id,
          collectionId: collectionId,
          name: file.name,
          size: file.size,
          numOfChunks,
        });
      },
    );

    return () => {
      // Call the specific cleanup functions returned by 'on'
      cleanupMcpServerLoaded();
      cleanupSignIn();
      cleanupKnowledgeImport();
      subscription.unsubscribe();
    };
  }, [loadAuthData, onAuthStateChange, loadSettings]);

  return <FluentApp />;
}
