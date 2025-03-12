/**
 * Sidebar
 */
import { useLocation } from 'react-router-dom';
import useAppearanceStore from 'stores/useAppearanceStore';
import GlobalNav from './GlobalNav';
import ChatNav from './ChatNav';
import AppNav from './AppNav';
import Footer from './Footer';
import { Button } from '@fluentui/react-components';
import { FeedbackIcon } from './GlobalNav';
import useNav from 'hooks/useNav';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import Mousetrap from 'mousetrap';
import { LightbulbFilamentRegular } from '@fluentui/react-icons';

import './AppSidebar.scss';
import BookmarkNav from './BookmarkNav';


export default function Sidebar() {
  const location = useLocation();
  const sidebar = useAppearanceStore((state) => state.sidebar);
  const theme = useAppearanceStore((state) => state.theme);
  const width = sidebar.hidden ? 'w-0' : 'w-auto';
  const left = sidebar.hidden ? 'md:left-0' : '-left-64 md:left-0';
  const leftCollapsed = sidebar.hidden ? '-left-64' : '-left-64 md:left-0';
  const navigate = useNav();
  const { t } = useTranslation();

  // IMPORTANT: Keep all hooks at the top level of the component
  // Add keyboard shortcut for feedback
  useEffect(() => {
    Mousetrap.bind('alt+f', () => {
      window.electron?.openExternal?.('https://omni-os.canny.io/omni');
      return false; // Prevent default and stop propagation
    });
    
    return () => {
      Mousetrap.unbind('alt+f');
    };
  }, []);

  const renderNav = () => {
    const activeRoute = location.pathname.split('/')[1];
    switch (activeRoute) {
      case 'apps':
        return <AppNav collapsed={sidebar.collapsed} />;
      case 'bookmarks':
        return <BookmarkNav collapsed={sidebar.collapsed}/>;
      default:
        return <ChatNav collapsed={sidebar.collapsed} />;
    }
  };

  // Glass morphism styles are mostly defined in AppSidebar.scss
  // but we add some dynamic styles based on theme here
  const glassStyles = {
    borderRight: `1px solid rgba(var(--color-border), 0.6)`,
  };

  return (
    <aside
      className={`app-sidebar shadow-md md:shadow-none z-20 pt-10 flex-shrink-0 ${
        sidebar.collapsed ? width : 'w-64 md:w-[17rem]'
      } fixed inset-y-0 top-0 ${
        sidebar.collapsed ? leftCollapsed : left
      } flex flex-col duration-300 h-full md:relative`}
      style={glassStyles}
    >
      {/* Glass reflection effect */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-white opacity-20"></div>
      
      <div className="flex h-full flex-col relative z-10">
        {/* Top global navigation section */}
        <GlobalNav collapsed={sidebar.collapsed} />
        
        {/* Middle scrollable content (including chat history/previous chats) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {renderNav()}
          </div>
          
          {/* Feedback button positioned to align with bell icon */}
          <div className={sidebar.collapsed ? 'hidden' : 'flex flex-col'}>
            <div className={`py-2 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <Button
                appearance="transparent"
                className={`w-full flex items-center px-2 py-2 rounded-lg ${
                  theme === 'dark' 
                    ? 'hover:bg-gray-800 text-gray-300' 
                    : 'hover:bg-gray-100 text-gray-700'
                } text-xs font-medium`}
                onClick={() => {
                  window.electron?.openExternal?.('https://omni-os.canny.io/omni');
                }}
              >
                <div className="flex items-center relative">
                  <div 
                    className={`inline-flex items-center ${
                      theme === 'dark' 
                        ? 'bg-amber-900/30 text-amber-300' 
                        : 'bg-amber-50/80 text-amber-600'
                    } text-sm font-medium px-3 py-1 rounded-sm mr-2`}
                  >
                    <span>{t('Common.Feedback')}</span>
                  </div>
                  <FeedbackIcon fontSize={16} className="ml-1" />
                  <div className="ml-1">
                    <span className="text-xs opacity-75">Share your ideas!</span>
                  </div>
                </div>
              </Button>
            </div>
          </div>
          
          {/* Footer positioned at the very bottom, after all content */}
          <Footer collapsed={sidebar.collapsed} />
        </div>
      </div>
    </aside>
  );
}