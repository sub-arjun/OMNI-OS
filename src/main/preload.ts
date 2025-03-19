// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */

// Early locale initialization to prevent crashes
(() => {
  try {
    // Ensure Intl object is initialized with safe defaults
    Intl.NumberFormat('en-US');
    Intl.DateTimeFormat('en-US');
    // Force locale initialization
    new Date().toLocaleDateString('en-US');
  } catch (e) {
    console.error('Failed to initialize locales:', e);
  }
})();

// Early ResizeObserver error suppression
// This runs before React loads and will suppress all ResizeObserver errors
(() => {
  // Store original error handlers
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Patterns to identify ResizeObserver-related errors
  const resizeObserverPatterns = [
    'ResizeObserver loop',
    'ResizeObserver Loop',
    'ResizeObserver completed with undelivered notifications',
    'ResizeObserver error'
  ];
  
  // Helper to check if a message relates to ResizeObserver
  const isResizeObserverError = (msg: string): boolean => 
    resizeObserverPatterns.some(pattern => msg && msg.includes(pattern));
  
  // Override console.error to filter out ResizeObserver errors
  console.error = function(...args) {
    if (args[0] && typeof args[0] === 'string' && isResizeObserverError(args[0])) {
      return; // Suppress the error
    }
    originalConsoleError.apply(console, args);
  };
  
  // Override console.warn to filter out ResizeObserver warnings
  console.warn = function(...args) {
    if (args[0] && typeof args[0] === 'string' && isResizeObserverError(args[0])) {
      return; // Suppress the warning
    }
    originalConsoleWarn.apply(console, args);
  };
  
  // Add global error handler
  window.addEventListener('error', (event) => {
    if (event.error && typeof event.error.message === 'string' && 
        isResizeObserverError(event.error.message)) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
    return true;
  }, true);
  
  // Add unhandled rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || String(event.reason);
    if (isResizeObserverError(message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
})();

import v8 from 'v8';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
// 设置文件描述符限制
if (process.platform !== 'win32') {
  process.setFdLimit(4096);
}

// 设置V8内存限制
v8.setFlagsFromString('--max-old-space-size=4096');

export type Channels =
  | 'ipc-5ire'
  | 'native-theme-change'
  | 'sign-in'
  | 'minimize-app'
  | 'maximize-app'
  | 'window-maximize'
  | 'download-started'
  | 'download-progress'
  | 'download-completed'
  | 'download-failed'
  | 'knowledge-import-progress'
  | 'knowledge-import-success'
  | 'get-embedding-model-file-status'
  | 'save-embedding-model-file'
  | 'remove-embedding-model'
  | 'close-app'
  | 'mcp-server-loaded';

const electronHandler = {
  store: {
    get(key: string, defaultValue?: any | undefined): any {
      return ipcRenderer.sendSync('get-store', key, defaultValue);
    },
    set(key: string, val: any) {
      ipcRenderer.sendSync('set-store', key, val);
    },
  },
  mcp: {
    init() {
      return ipcRenderer.invoke('mcp-init');
    },
    addServer(server: any): Promise<boolean> {
      return ipcRenderer.invoke('mcp-add-server', server);
    },
    updateServer(server: any): Promise<boolean> {
      return ipcRenderer.invoke('mcp-update-server', server);
    },
    activate(config: {
      key: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    }): Promise<{ error: any }> {
      return ipcRenderer.invoke('mcp-activate', config);
    },
    deactivated(clientName: string): Promise<{ error: any }> {
      return ipcRenderer.invoke('mcp-deactivate', clientName);
    },
    listTools(name?: string) {
      return ipcRenderer.invoke('mcp-list-tools', name);
    },
    callTool({
      client,
      name,
      args,
    }: {
      client: string;
      name: string;
      args: any;
    }) {
      return ipcRenderer.invoke('mcp-call-tool', { client, name, args });
    },
    getConfig(): Promise<any> {
      return ipcRenderer.invoke('mcp-get-config');
    },
    putConfig(config: any): Promise<boolean> {
      return ipcRenderer.invoke('mcp-put-config', config);
    },
    getActiveServers(): Promise<string[]> {
      return ipcRenderer.invoke('mcp-get-active-servers');
    },
  },
  crypto: {
    encrypt(text: string, key: string) {
      return ipcRenderer.invoke('encrypt', text, key);
    },
    decrypt(encrypted: string, key: string, iv: string) {
      return ipcRenderer.invoke('decrypt', encrypted, key, iv);
    },
    hmacSha256Hex(data: string, key: string) {
      return ipcRenderer.invoke('hmac-sha256-hex', data, key);
    },
  },
  openExternal(url: string) {
    return ipcRenderer.invoke('open-external', url);
  },
  getUserDataPath(paths?: string[]) {
    return ipcRenderer.invoke('get-user-data-path', paths);
  },
  db: {
    all<T>(sql: string, params: any | undefined = undefined): Promise<T[]> {
      return ipcRenderer.invoke('db-all', { sql, params });
    },
    get<T>(sql: string, id: any): Promise<T> {
      return ipcRenderer.invoke('db-get', { sql, id });
    },
    run(sql: string, params: any): Promise<boolean> {
      return ipcRenderer.invoke('db-run', { sql, params });
    },
    transaction(tasks: { sql: string; params: any[] }[]): Promise<boolean> {
      return ipcRenderer.invoke('db-transaction', tasks);
    },
  },
  getProtocol: () => ipcRenderer.invoke('get-protocol'),
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getNativeTheme: () => ipcRenderer.invoke('get-native-theme'),
  getSystemLanguage: () => ipcRenderer.invoke('get-system-language'),
  selectImageWithBase64: () => ipcRenderer.invoke('select-image-with-base64'),
  embeddings: {
    getModelFileStatus: () =>
      ipcRenderer.invoke('get-embedding-model-file-status'),
    removeModel: () => ipcRenderer.invoke('remove-embedding-model'),
    saveModelFile: (fileName: string, filePath: string) =>
      ipcRenderer.invoke('save-embedding-model-file', fileName, filePath),
  },
  knowledge: {
    selectFiles: () => ipcRenderer.invoke('select-knowledge-files'),
    importFile: ({
      file,
      collectionId,
    }: {
      file: {
        id: string;
        path: string;
        name: string;
        size: number;
        type: string;
      };
      collectionId: string;
    }) =>
      ipcRenderer.invoke('import-knowledge-file', {
        file,
        collectionId,
      }),
    search: (collectionIds: string[], query: string) =>
      ipcRenderer.invoke('search-knowledge', collectionIds, query),
    removeFile: (fileId: string) =>
      ipcRenderer.invoke('remove-knowledge-file', fileId),
    removeCollection: (collectionId: string) =>
      ipcRenderer.invoke('remove-knowledge-collection', collectionId),
    getChunk: (id: string) => ipcRenderer.invoke('get-knowledge-chunk', id),
    close: () => ipcRenderer.invoke('close-knowledge-database'),
    testOmniBaseConnection: (indexName: string, namespace?: string) =>
      ipcRenderer.invoke('test-omnibase-connection', indexName, namespace),
    createOmniBaseCollection: (name: string, indexName: string, namespace?: string) =>
      ipcRenderer.invoke('create-omnibase-collection', name, indexName, namespace),
  } as const,
  download: (fileName: string, url: string) =>
    ipcRenderer.invoke('download', fileName, url),
  cancelDownload: (fileName: string) =>
    ipcRenderer.invoke('cancel-download', fileName),
  setNativeTheme: (theme: 'light' | 'dark' | 'system') =>
    ipcRenderer.invoke('set-native-theme', theme),
  ingestEvent: (data: any) => ipcRenderer.invoke('ingest-event', data),
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    unsubscribe(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.removeListener(channel, func);
    },
    unsubscribeAll(channel: Channels) {
      ipcRenderer.removeAllListeners(channel);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

const envVars = {
  SUPA_PROJECT_ID: process.env.SUPA_PROJECT_ID,
  SUPA_KEY: process.env.SUPA_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NODE_ENV: process.env.NODE_ENV,
};
contextBridge.exposeInMainWorld('envVars', envVars);

export type ElectronHandler = typeof electronHandler;
export type EnvVars = typeof envVars;
