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

  useEffect(() => {
    // Apply suppression again in case our component mounts after some errors occurred
    initSuppressResizeObserverErrors();
    
    loadAuthData();
    Mousetrap.prototype.stopCallback = () => {
      return false;
    };
    const subscription = onAuthStateChange();
    window.electron.mcp.init();
    window.electron.ipcRenderer.on(
      'mcp-server-loaded',
      async (serverNames: any) => {
        debug('🚩 MCP Server Loaded:', serverNames);
        loadConfig(true);
        updateLoadingState(false);
      },
    );

    window.electron.ipcRenderer.on('sign-in', async (authData: any) => {
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

    /**
     * 当知识库导入任务完成时触发
     * 放這是为了避免组件卸载后无法接收到事件
     */
    window.electron.ipcRenderer.on(
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
      window.electron.ipcRenderer.unsubscribeAll('mcp-server-loaded');
      window.electron.ipcRenderer.unsubscribeAll('sign-in');
      window.electron.ipcRenderer.unsubscribeAll('knowledge-import-success');
      subscription.unsubscribe();
    };
  }, [loadAuthData, onAuthStateChange]);

  return <FluentApp />;
}
