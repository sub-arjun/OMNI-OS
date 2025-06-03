import * as logging from './logging';
import Debug from 'debug';
import FluentApp from './components/FluentApp';
import useAuthStore from 'stores/useAuthStore';
import useAppearanceStore from 'stores/useAppearanceStore';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useMCPStore from 'stores/useMCPStore';
import Mousetrap from 'mousetrap';
import './i18n';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { initSuppressResizeObserverErrors } from '../utils/suppressResizeObserverErrors';
import useSettingsStore from 'stores/useSettingsStore';
import 'utils/localePolyfill'; // Import locale polyfill early to prevent crashes

// Apply ResizeObserver suppression immediately, before anything else
initSuppressResizeObserverErrors();

// Early locale initialization to prevent media element crashes
(() => {
  try {
    // Ensure document has a language set
    if (typeof document !== 'undefined') {
      document.documentElement.lang = document.documentElement.lang || 'en-US';
      document.documentElement.dir = document.documentElement.dir || 'ltr';
    }
    
    // Initialize Intl APIs that might be used by media controls
    new Intl.NumberFormat('en-US').format(1234.5);
    new Intl.DateTimeFormat('en-US').format(new Date());
    
    // Force Chrome's locale system to initialize
    if ('chrome' in window && (window as any).chrome?.i18n?.getUILanguage) {
      try {
        (window as any).chrome.i18n.getUILanguage();
      } catch (e) {
        // Ignore if not available
      }
    }
  } catch (e) {
    console.warn('Early locale initialization warning:', e);
  }
})();

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
  const { t } = useTranslation();
  const { createFile } = useKnowledgeStore();
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const theme = useAppearanceStore((state) => state.theme);

  // Early theme application to prevent background transparency
  useEffect(() => {
    // Apply current theme to document immediately
    document.documentElement.setAttribute('data-theme', theme as string);
    document.documentElement.className = document.documentElement.className
      .replace(/theme-(light|dark)/g, '')
      .trim() + ` theme-${theme as string}`;
  }, [theme]);

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
          console.error('Auth error:', error.message);
          // Toast notification will be handled by the auth store or login component
        }
      } else {
        debug('🚩 Invalid Auth Data:', authData);
        console.error('Invalid auth data:', t('Auth.Notification.LoginCallbackFailed'));
        // Toast notification will be handled by the auth store or login component
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
