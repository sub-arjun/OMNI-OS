export interface ElectronHandler {
  store: {
    get: (key: string, defaultValue?: any) => any;
    set: (key: string, val: any) => void;
  };
  mcp: {
    init: () => Promise<any>;
    addServer: (server: any) => Promise<boolean>;
    updateServer: (server: any) => Promise<boolean>;
    activate: (config: {
      key: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    }) => Promise<{ error: any }>;
    deactivated: (clientName: string) => Promise<{ error: any }>;
    listTools: (name?: string) => Promise<any>;
    callTool: (params: { client: string; name: string; args: any }) => Promise<any>;
    getConfig: () => Promise<any>;
    putConfig: (config: any) => Promise<boolean>;
    getActiveServers: () => Promise<string[]>;
  };
  prompts: {
    get: () => Promise<Array<{ text: string; type: string }>>;
    refresh: () => Promise<Array<{ text: string; type: string }>>;
  };
  crypto: {
    encrypt: (text: string, key: string) => Promise<string>;
    decrypt: (encrypted: string, key: string, iv: string) => Promise<string>;
    hmacSha256Hex: (data: string, key: string) => Promise<string>;
  };
  openExternal: (url: string) => Promise<void>;
  getUserDataPath: (paths?: string[]) => Promise<string>;
  db: {
    all: <T>(sql: string, params?: any) => Promise<T[]>;
    get: <T>(sql: string, id: any) => Promise<T>;
    run: (sql: string, params: any) => Promise<boolean>;
    transaction: (tasks: { sql: string; params: any[] }[]) => Promise<boolean>;
  };
  getProtocol: () => Promise<string>;
  getDeviceInfo: () => Promise<any>;
  getAppVersion: () => Promise<string>;
  getNativeTheme: () => Promise<'light' | 'dark' | 'system'>;
  getSystemLanguage: () => Promise<string>;
  selectImageWithBase64: () => Promise<string | null>;
  embeddings: {
    getModelFileStatus: () => Promise<any>;
    removeModel: () => Promise<boolean>;
    saveModelFile: (fileName: string, filePath: string) => Promise<boolean>;
  };
  knowledge: {
    selectFiles: () => Promise<any[]>;
    importFile: (params: {
      file: {
        id: string;
        path: string;
        name: string;
        size: number;
        type: string;
      };
      collectionId: string;
    }) => Promise<boolean>;
    search: (collectionIds: string[], query: string) => Promise<string>;
    removeFile: (fileId: string) => Promise<boolean>;
    removeCollection: (collectionId: string) => Promise<boolean>;
    getChunk: (id: string) => Promise<any>;
    close: () => Promise<void>;
    testOmniBaseConnection: (indexName: string, namespace?: string) => Promise<boolean>;
    createOmniBaseCollection: (name: string, indexName: string, namespace?: string) => Promise<string>;
  };
  download: (fileName: string, url: string) => Promise<boolean>;
  cancelDownload: (fileName: string) => Promise<boolean>;
  setNativeTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  ingestEvent: (data: any) => Promise<void>;
  fetchRemoteConfig: (url: string) => Promise<any>;
  ipcRenderer: {
    sendMessage: (channel: string, ...args: unknown[]) => void;
    on: (channel: string, func: (...args: unknown[]) => void) => () => void;
    once: (channel: string, func: (...args: unknown[]) => void) => void;
    unsubscribe: (channel: string, func: (...args: unknown[]) => void) => void;
    unsubscribeAll: (channel: string) => void;
  };
}

interface EnvVars {
  SUPA_PROJECT_ID: string;
  SUPA_KEY: string;
  SENTRY_DSN: string;
  NODE_ENV: string;
}

interface AudioContextManagement {
  registerAudioContext: (audioContext: AudioContext) => AudioContext;
  cleanupAudioContexts: () => void;
}

declare global {
  interface Window {
    electron: ElectronHandler;
    envVars: EnvVars;
    _openAudioContexts?: AudioContext[];
    _audioContextManagement: AudioContextManagement;
  }
} 