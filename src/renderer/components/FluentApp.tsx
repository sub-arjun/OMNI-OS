import { useEffect } from 'react';
import Debug from 'debug';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { captureException } from '../logging';
import {
  FluentProvider,
  Toaster,
  BrandVariants,
  createLightTheme,
  Theme,
  createDarkTheme,
} from '@fluentui/react-components';
import useSettingsStore from '../../stores/useSettingsStore';
import useAppearanceStore from '../../stores/useAppearanceStore';
import AppHeader from './layout/AppHeader';
import AppSidebar from './layout/aside/AppSidebar';
import Chat from '../pages/chat';
import Knowledge from '../pages/knowledge';
import KnowledgeCollectionForm from '../pages/knowledge/CollectionForm';
import Tools from '../pages/tool';
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

// Coming Soon component for Analytics
const ComingSoon = () => {
  const { t } = useTranslation();
  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
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
      <div className="page-top-bar"></div>
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

darkTheme.colorBrandForeground1 = fire[120];
darkTheme.colorBrandForeground2 = fire[130];

export default function FluentApp() {
  const { i18n } = useTranslation();
  const themeSettings = useSettingsStore((state) => state.theme);
  const theme = useAppearanceStore((state) => state.theme);
  const language = useSettingsStore((state) => state.language);
  const setTheme = useAppearanceStore((state) => state.setTheme);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    window.electron.ipcRenderer.on('native-theme-change', (_theme: unknown) => {
      if (themeSettings === 'system') {
        setTheme(_theme as 'light' | 'dark');
        debug(`Theme Change to: ${_theme}`);
      }
    });
    return () => {
      window.electron.ipcRenderer.unsubscribeAll('native-theme-change');
    };
  }, [themeSettings, setTheme]);

  useEffect(() => {
    if (themeSettings === 'system') {
      window.electron
        .getNativeTheme()
        .then((_theme) => {
          debug(`Theme: ${_theme}`);
          return setTheme(_theme);
        })
        .catch(captureException);
    } else {
      setTheme(themeSettings);
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
  }, [themeSettings, setTheme]);

  return (
    <FluentProvider
      theme={theme === 'light' ? lightTheme : darkTheme}
      data-theme={theme}
    >
      <Router>
        {user && <AppHeader />}
        <Toaster toasterId="toaster" limit={5} offset={{ vertical: 25 }} />
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
                <Route path="/tool" element={<Tools />} />
                <Route path="/apps/:key" element={<AppLoader />} />
                <Route path="/bookmarks" element={<Bookmarks />} />
                <Route path="/bookmarks/:id" element={<Bookmark />} />
                <Route path="/user/account" element={<Account />} />
                <Route path="/usage" element={<ComingSoon />} />
                <Route path="/prompts" element={<Prompts />} />
                <Route path="/prompts/form/:id?" element={<PromptForm />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Routes>
            <div
              id="portal"
              style={{ zIndex: 9999999, position: 'absolute' }}
            ></div>
          </main>
        </div>
      </Router>
    </FluentProvider>
  );
}
