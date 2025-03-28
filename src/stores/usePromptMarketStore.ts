import { create } from 'zustand';
import { IPromptDef } from 'intellichat/types';
import { captureException } from '../renderer/logging';

const PROMPT_MARKET_URL = 'https://config-omni.s3.us-west-2.amazonaws.com/OMNI-prompt-config.json';

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
    // Check if we need to refresh (if it's been more than an hour or force is true)
    const currentTime = Date.now();
    const lastUpdate = get().updatedAt;
    const hourInMs = 60 * 60 * 1000;
    
    // Don't fetch if we already have prompts and not forcing a refresh and less than an hour has passed
    if (get().prompts.length > 0 && !force && (currentTime - lastUpdate) < hourInMs) {
      return;
    }
    
    set({ loading: true, error: null });
    try {
      const res = await fetch(PROMPT_MARKET_URL, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch prompts: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      // Ensure the data is in the expected format (array of IPromptDef)
      if (!Array.isArray(data)) {
        throw new Error('Prompts data is not in the expected format');
      }
      
      // Process and validate each prompt
      const validPrompts = data.filter((prompt: any) => {
        // Must have a name and at least one of systemMessage or userMessage
        return (
          prompt.name && 
          (prompt.systemMessage || prompt.userMessage)
        );
      });
      
      set({ 
        prompts: validPrompts,
        loading: false,
        updatedAt: currentTime 
      });
    } catch (error) {
      console.error('Error fetching prompts:', error);
      
      // Handle the error safely for capturing
      if (error instanceof Error) {
        captureException(error);
        set({ error: error.message, loading: false });
      } else {
        const errorMessage = String(error);
        captureException(new Error(errorMessage));
        set({ error: errorMessage, loading: false });
      }
    }
  },
}));

export default usePromptMarketStore; 