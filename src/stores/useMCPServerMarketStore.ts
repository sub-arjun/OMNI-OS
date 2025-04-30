import { create } from 'zustand';
import { IMCPServer } from './../types/mcp.d';
import { captureException } from '../renderer/logging';

const REMOTE_CONFIG_TTL: number = 1000 * 60 * 60; // 1 hour
const CONFIG_URL = 'https://config-omni.s3.us-west-2.amazonaws.com/omni-config.json';

interface IMCPServerMarketStore {
  servers: IMCPServer[];
  updatedAt: number;
  fetchServers: (force?: boolean) => Promise<IMCPServer[]>;
}

const useMCPServerMarketStore = create<IMCPServerMarketStore>((set, get) => ({
  servers: [],
  updatedAt: 0,
  fetchServers: async (force = false) => {
    const { servers, updatedAt } = get();
    if (!force && updatedAt > Date.now() - REMOTE_CONFIG_TTL) {
      console.log('Using cached MCP server market data.');
      return servers;
    }
    console.log('Fetching fresh MCP server market data...');
    try {
      const data = await window.electron.fetchRemoteConfig(CONFIG_URL);
      
      if (data) {
        console.log('Successfully fetched MCP server market data:', data);
        set({
          servers: data,
          updatedAt: Date.now(),
        });
        return data;
      } else {
        console.error('Received null or undefined data from fetch-remote-config handler.');
        captureException('Received null/undefined data from fetch-remote-config');
        return [];
      }

    } catch (error: any) {
      console.error('Error fetching MCP server market data via main process:', error);
      captureException(error);
      return [];
    }
  },
}));

export default useMCPServerMarketStore;
