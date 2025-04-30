import { create } from 'zustand';
import { IPromptDef } from 'intellichat/types';
import { captureException } from '../renderer/logging';

const PROMPT_MARKET_URL = 'https://config-omni.s3.us-west-2.amazonaws.com/OMNI-prompt-config.json';
const PROMPT_CONFIG_TTL = 60 * 60 * 1000; // Cache for 1 hour

interface IPromptMarketStore {
  prompts: IPromptDef[];
  loading: boolean;
  error: string | null;
  updatedAt: number;
  fetchPrompts: (force?: boolean) => Promise<void>;
}

const usePromptMarketStore = create<IPromptMarketStore>((set, get) => ({
  prompts: [],
  loading: false,
  error: null,
  updatedAt: 0,
  fetchPrompts: async (force = false) => {
    const currentTime = Date.now();
    const lastUpdate = get().updatedAt;
    
    if (!force && get().prompts.length > 0 && (currentTime - lastUpdate) < PROMPT_CONFIG_TTL) {
      console.log('Using cached prompt market data.');
      return;
    }
    
    console.log('Fetching fresh prompt market data...');
    set({ loading: true, error: null });
    try {
      // Use the IPC handler to fetch the config via the main process
      const data = await window.electron.fetchRemoteConfig(PROMPT_MARKET_URL);
      
      if (!data) {
        throw new Error('Received null or undefined data from fetch-remote-config for prompts.');
      }
      
      if (!Array.isArray(data)) {
        throw new Error('Prompts data is not in the expected array format');
      }
      
      const validPrompts = data.filter((prompt: any) => 
        prompt.name && (prompt.systemMessage || prompt.userMessage)
      ) as IPromptDef[];
      
      console.log(`Successfully fetched ${validPrompts.length} valid prompts.`);
      set({ 
        prompts: validPrompts,
        loading: false,
        updatedAt: currentTime 
      });
    } catch (error: any) {
      console.error('Error fetching prompts via main process:', error);
      captureException(error); // Log the error propagated from the main process
      set({ error: error.message || 'Unknown error', loading: false });
    }
  },
}));

export default usePromptMarketStore; 