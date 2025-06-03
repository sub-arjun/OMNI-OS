import { create } from 'zustand';
import { ThemeType } from 'types/appearance';

// Get theme from localStorage or default to 'light'
const getInitialTheme = (): 'light' | 'dark' => {
  try {
    // Try localStorage first as a reliable fallback
    const localTheme = localStorage.getItem('app-theme');
    if (localTheme === 'dark' || localTheme === 'light') {
      return localTheme;
    }
    
    // Default to light theme
    return 'light';
  } catch (error) {
    console.warn('Failed to load theme from localStorage:', error);
    return 'light';
  }
};

interface IAppearanceStore {
  theme: Omit<ThemeType, 'system'>;
  sidebar: {
    hidden: boolean;
    collapsed: boolean;
  };
  chatSidebar: {
    show: boolean;
  };
  setTheme: (theme: 'light' | 'dark') => void;
  initializeThemeFromSettings: (theme: ThemeType) => void;
  toggleSidebarCollapsed: () => void;
  toggleSidebarVisibility: () => void;
  toggleChatSidebarVisibility: () => void;
  getPalette: (name: 'success' | 'warning' | 'error' | 'info') => string;
}

const useAppearanceStore = create<IAppearanceStore>((set, get) => ({
  theme: getInitialTheme(),
  sidebar: {
    hidden: localStorage.getItem('sidebar-hidden') === 'true',
    collapsed: localStorage.getItem('sidebar-collapsed') === 'true',
  },
  chatSidebar: {
    show: localStorage.getItem('chat-sidebar-show') === 'true',
  },
  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
    
    // Persist theme to localStorage as backup
    try {
      localStorage.setItem('app-theme', theme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
    
    // Apply theme immediately to document to prevent transparency issues
    try {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.className = document.documentElement.className
        .replace(/theme-(light|dark)/g, '')
        .trim() + ` theme-${theme}`;
    } catch (error) {
      console.warn('Failed to apply theme to document:', error);
    }
  },
  initializeThemeFromSettings: (settingsTheme: ThemeType) => {
    // This method will be called by FluentApp to sync with settings store
    let resolvedTheme: 'light' | 'dark' = 'light';
    
    if (settingsTheme === 'dark') {
      resolvedTheme = 'dark';
    } else if (settingsTheme === 'light') {
      resolvedTheme = 'light';
    }
    // For 'system', we'll let FluentApp handle the resolution
    
    const currentTheme = get().theme;
    if (currentTheme !== resolvedTheme) {
      get().setTheme(resolvedTheme);
    }
  },
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
