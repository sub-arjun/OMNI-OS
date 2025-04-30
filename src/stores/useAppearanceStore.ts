import { create } from 'zustand';
import { ThemeType } from 'types/appearance';

const defaultTheme = 'light';

interface IAppearanceStore {
  theme: Omit<ThemeType, 'system'>;
  sidebar: {
    hidden: boolean;
    collapsed: boolean;
  };
  chatSidebar: {
    show: boolean;
  };
  setTheme: (theme: Omit<ThemeType, 'system'>) => void;
  toggleSidebarCollapsed: () => void;
  toggleSidebarVisibility: () => void;
  toggleChatSidebarVisibility: () => void;
  getPalette: (name: 'success' | 'warning' | 'error' | 'info') => string;
}

const useAppearanceStore = create<IAppearanceStore>((set, get) => ({
  theme: defaultTheme,
  sidebar: {
    hidden: localStorage.getItem('sidebar-hidden') === 'true',
    collapsed: localStorage.getItem('sidebar-collapsed') === 'true',
  },
  chatSidebar: {
    show: localStorage.getItem('chat-sidebar-show') === 'true',
  },
  setTheme: (theme: Omit<ThemeType, 'system'>) => set({ theme }),
  toggleSidebarCollapsed: () => {
    set((state) => {
      const collapsed = !state.sidebar.collapsed;
      const hidden = false;
      localStorage.setItem('sidebar-collapsed', String(collapsed));
      window.electron.ingestEvent([{ app: 'toggle-sidebar-collapsed' }]);
      return { sidebar: { collapsed, hidden } };
    });
  },
  toggleSidebarVisibility: () => {
    set((state) => {
      const hidden = !state.sidebar.hidden;
      const collapsed = false;
      localStorage.setItem('sidebar-hidden', String(hidden));
      window.electron.ingestEvent([{ app: 'toggle-sidebar-visibility' }]);
      return { sidebar: { collapsed, hidden } };
    });
  },
  toggleChatSidebarVisibility: () => {
    set((state) => {
      const show = !state.chatSidebar.show;
      console.log(`AppearanceStore: Toggling chatSidebar visibility to: ${show}`);
      localStorage.setItem('chat-sidebar-show', String(show));
      window.electron.ingestEvent([{ app: 'toggle-chat-sidebar-visibility' }]);
      return { chatSidebar: { show } };
    });
  },
  getPalette: (name: 'error' | 'warning' | 'success' | 'info') => {
    const light = {
      success: '#3d7d3f',
      warning: '#d98926',
      error: '#c6474e',
      info: '#6e747d',
    };
    const dark = {
      success: '#64b75d',
      warning: '#e6a52a',
      error: '#de5d43',
      info: '#e7edf2',
    };
    const { theme } = get();
    return theme === 'dark' ? dark[name] : light[name];
  },
}));

export default useAppearanceStore;
