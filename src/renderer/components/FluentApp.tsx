import { useEffect } from 'react';
import Debug from 'debug';
import { MemoryRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { captureException } from '../logging';
import {
  FluentProvider,
  BrandVariants,
  createLightTheme,
  Theme,
  createDarkTheme,
  IdPrefixProvider,
} from '@fluentui/react-components';
import { CustomToastProvider } from './CustomToast';
import useSettingsStore from '../../stores/useSettingsStore';
import useAppearanceStore from '../../stores/useAppearanceStore';
import AppHeader from './layout/AppHeader';
import AppSidebar from './layout/aside/AppSidebar';
import Chat from '../pages/chat';
import Knowledge from '../pages/knowledge';
import KnowledgeCollectionForm from '../pages/knowledge/CollectionForm';
import Tool from '../pages/tool';
import Bookmarks from '../pages/bookmark';
import Bookmark from '../pages/bookmark/Bookmark';
import Usage from '../pages/usage';
import Login from '../pages/user/Login';
import Register from '../pages/user/Register';
import Account from '../pages/user/Account';
import Settings from '../pages/settings';
import Prompts from '../pages/prompt';
import PromptForm from '../pages/prompt/Form';
import AppLoader from '../apps/Loader';
import { useTranslation } from 'react-i18next';
import Empty from './Empty';
import ProtectedRoute from './ProtectedRoute';
import useAuthStore from 'stores/useAuthStore';
import TrafficLights from './TrafficLights';

const debug = Debug('OMNI-OS:components:FluentApp');

const fire: BrandVariants = {
  10: '#030303',
  20: '#171717',
  30: '#252525',
  40: '#313131',
  50: '#3D3D3D',
  60: '#494949',
  70: '#565656',
  80: '#636363',
  90: '#717171',
  100: '#7F7F7F',
  110: '#8D8D8D',
  120: '#9B9B9B',
  130: '#AAAAAA',
  140: '#B9B9B9',
  150: '#C8C8C8',
  160: '#D7D7D7',
};

const lightTheme: Theme = {
  ...createLightTheme(fire),
};

const darkTheme: Theme = {
  ...createDarkTheme(fire),
};

// Enhance dark theme for better contrast
darkTheme.colorBrandForeground1 = fire[120];
darkTheme.colorBrandForeground2 = fire[130];

// Improve text contrast in dark mode
darkTheme.colorNeutralForeground1 = '#FFFFFF';
darkTheme.colorNeutralForeground2 = '#F5F5F5';
darkTheme.colorNeutralForeground3 = '#EBEBEB';
darkTheme.colorNeutralForegroundInverted = '#000000';

// Improve contrast for input fields
darkTheme.colorNeutralForegroundOnBrand = '#FFFFFF';
darkTheme.colorCompoundBrandForeground1 = '#FFFFFF';
darkTheme.colorNeutralForegroundDisabled = '#A0A0A0';

// Improve contrast for interactive elements
darkTheme.colorNeutralForegroundInvertedLink = '#FFFFFF';
darkTheme.colorBrandForegroundLink = '#FFFFFF';
darkTheme.colorNeutralForeground2Link = '#FFFFFF';

// Coming Soon component for Analytics
const ComingSoon = () => {
  const { t } = useTranslation();
  return (
    <div className="page h-full">
      <div className="page-top-bar">
        <div className="absolute top-2.5 left-5 z-50">
          <TrafficLights />
        </div>
      </div>
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t('Common.Analytics')}</h1>
        </div>
      </div>
      <div className="mt-2.5 pb-28 h-full -mr-5 overflow-y-auto flex flex-col items-center justify-center">
        <Empty image="usage" text={t('Coming Soon')} />
        <p className="text-gray-500 mt-4">This feature is currently under development.</p>
      </div>
    </div>
  );
};

// Coming Soon component for Authentication features
const ComingSoonAuth = () => {
  const { t } = useTranslation();
  return (
    <div className="page h-full">
      <div className="page-top-bar">
        <div className="absolute top-2.5 left-5 z-50">
          <TrafficLights />
        </div>
      </div>
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t('Account.SignUp')}</h1>
        </div>
      </div>
      <div className="mt-2.5 pb-28 h-full -mr-5 overflow-y-auto flex flex-col items-center justify-center">
        <Empty image="usage" text={t('Coming Soon')} />
        <p className="text-gray-500 mt-4">This feature is currently under development.</p>
      </div>
    </div>
  );
};

// Component to handle route changes and cleanup
function RouteChangeHandler() {
  const location = useLocation();

  useEffect(() => {
    // Force cleanup of any lingering Fluent UI components on route change
    const cleanup = () => {
      // Close any open dialogs, popovers, or menus
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(escapeEvent);
    };

    // Cleanup on route change
    return cleanup;
  }, [location.pathname]);

  return null;
}

export default function FluentApp() {
  const { i18n } = useTranslation();
  const themeSettings = useSettingsStore((state) => state.theme);
  const theme = useAppearanceStore((state) => state.theme);
  const language = useSettingsStore((state) => state.language);
  const setTheme = useAppearanceStore((state) => state.setTheme);
  const initializeThemeFromSettings = useAppearanceStore((state) => state.initializeThemeFromSettings);
  const user = useAuthStore((state) => state.user);

  // Define click handler outside useEffect to avoid recreation
  const handleGlobalClickAway = (event: MouseEvent) => {
    // Find all open popovers
    const popovers = document.querySelectorAll('.fui-PopoverSurface');
    
    // Check if click is outside any popover
    popovers.forEach((popover) => {
      if (popover && !popover.contains(event.target as Node)) {
        // Try to find a close button or trigger button and click it
        const closeBtn = popover.querySelector('[aria-label="close"]');
        if (closeBtn && closeBtn instanceof HTMLElement) {
          closeBtn.click();
        }
      }
    });
  };

  // Add global click-away handler for popovers
  useEffect(() => {
    // Add the event listener
    document.addEventListener('mousedown', handleGlobalClickAway);
    
    // Return cleanup function
    return () => {
      document.removeEventListener('mousedown', handleGlobalClickAway);
    };
  }, []);

  useEffect(() => {
    const handleThemeChange = (...args: unknown[]) => {
      const nativeTheme = args[0] as 'light' | 'dark';
      setTheme(nativeTheme);
    };

    // Use the cleanup function returned by window.electron.ipcRenderer.on
    const cleanupThemeChangeListener = window.electron.ipcRenderer.on(
      'native-theme-change',
      handleThemeChange
    );

    return () => {
      // Call the specific cleanup function
      cleanupThemeChangeListener();
    };
  }, [setTheme]);

  useEffect(() => {
    if (themeSettings === 'system') {
      window.electron
        .getNativeTheme()
        .then((_theme: 'light' | 'dark') => {
          debug(`System theme resolved to: ${_theme}`);
          setTheme(_theme);
        })
        .catch(captureException);
    } else {
      // Synchronize appearance store with settings store
      initializeThemeFromSettings(themeSettings);
    }

    if (language === 'system') {
      window.electron
        .getSystemLanguage()
        .then((_lang) => {
          return i18n.changeLanguage(_lang);
        })
        .catch(captureException);
    } else {
      i18n.changeLanguage(language);
    }
  }, [themeSettings, setTheme, initializeThemeFromSettings, i18n, language]);

  // Early theme application to prevent transparency issues
  useEffect(() => {
    // Apply theme immediately to document when theme changes
    document.documentElement.setAttribute('data-theme', theme as string);
    document.documentElement.className = document.documentElement.className
      .replace(/theme-(light|dark)/g, '')
      .trim() + ` theme-${theme as string}`;
  }, [theme]);

  return (
    <IdPrefixProvider value="omni-os-">
      <FluentProvider
        theme={theme === 'light' ? lightTheme : darkTheme}
        data-theme={theme}
        className={`theme-${theme}`}
      >
        <CustomToastProvider>
          <Router>
            <RouteChangeHandler />
            {user && <AppHeader />}
            <div className="relative flex h-screen w-full overflow-hidden main-container">
              {user && <AppSidebar />}
              <main className="relative px-5 flex h-full w-full flex-col overflow-hidden">
                <Routes>
                  {/* Public routes that don't require authentication */}
                  <Route path="/user/login" element={<Login />} />
                  <Route path="/user/register" element={<ComingSoonAuth />} />
                  
                  {/* Protected routes that require authentication */}
                  <Route element={<ProtectedRoute />}>
                    <Route index element={<Chat />} />
                    <Route path="/chats/:id?/:anchor?" element={<Chat />} />
                    <Route path="/knowledge" element={<Knowledge />} />
                    <Route
                      path="/knowledge/collection-form/:id?"
                      element={<KnowledgeCollectionForm />}
                    />
                    <Route path="/tool/:id?" element={<Tool />} />
                    <Route path="/apps/:key" element={<AppLoader />} />
                    <Route path="/bookmarks" element={<Bookmarks />} />
                    <Route path="/bookmark/:id" element={<Bookmark />} />
                    <Route path="/usage" element={<Usage />} />
                    <Route path="/user/account" element={<Account />} />
                    <Route path="/prompts" element={<Prompts />} />
                    <Route path="/prompts/form/:id?" element={<PromptForm />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/chats" replace />} />
                </Routes>
                <div
                  id="portal"
                  style={{ zIndex: 9999999, position: 'absolute' }}
                ></div>
              </main>
            </div>
          </Router>
        </CustomToastProvider>
      </FluentProvider>
    </IdPrefixProvider>
  );
}
