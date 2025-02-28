import { create } from 'zustand';
import { IMCPServer } from './../types/mcp.d';
import { captureException } from '../renderer/logging';

const REMOTE_CONFIG_TTL: number = 1000 * 60 * 60 * 24; // 1 day

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
      return servers;
    }
    try {
      const resp = await fetch('https://config-omni.s3.us-west-2.amazonaws.com/omni-config.json');
      if (resp.ok) {
        const data = await resp.json();
        set({
          servers: data,
          updatedAt: Date.now(),
        });
        return data;
      }
      captureException(resp.statusText);
      return [];
    } catch (error: any) {
      captureException(error);
      return [];
    }
  },
}));

export default useMCPServerMarketStore;
