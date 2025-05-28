/**
 * Sidebar
 */
import { useLocation } from 'react-router-dom';
import useAppearanceStore from 'stores/useAppearanceStore';
import GlobalNav from './GlobalNav';
import ChatNav from './ChatNav';
import AppNav from './AppNav';
import Footer from './Footer';
import { Button, Tooltip, Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components';
import { FeedbackIcon } from './GlobalNav';
import useNav from 'hooks/useNav';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import Mousetrap from 'mousetrap';
import { LightbulbFilamentRegular } from '@fluentui/react-icons';
import {
  Wifi124Filled,
  Wifi124Regular,
  WifiOff24Filled,
  WifiOff24Regular,
  bundleIcon,
} from '@fluentui/react-icons';
import useOnlineStatus from 'hooks/useOnlineStatus';

import './AppSidebar.scss';
import BookmarkNav from './BookmarkNav';

const OnlineIcon = bundleIcon(Wifi124Filled, Wifi124Regular);
const OfflineIcon = bundleIcon(WifiOff24Filled, WifiOff24Regular);

export default function Sidebar() {
  const location = useLocation();
  const sidebar = useAppearanceStore((state) => state.sidebar);
  const theme = useAppearanceStore((state) => state.theme);
  const navigate = useNav();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

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
    // borderRight: `1px solid rgba(var(--color-border), 0.6)`, // Removed this line
  };

  const NetworkStatusIcon = isOnline ? (
    <Popover withArrow size="small" closeOnScroll>
      <PopoverTrigger disableButtonEnhancement>
        <Button 
          icon={<OnlineIcon />} 
          appearance="transparent" 
          size="small"
        />
      </PopoverTrigger>
      <PopoverSurface>
        <div>{t('Common.Online')}</div>
      </PopoverSurface>
    </Popover>
  ) : (
    <Popover withArrow size="small" closeOnScroll>
      <PopoverTrigger disableButtonEnhancement>
        <Button 
          icon={<OfflineIcon />} 
          appearance="transparent" 
          size="small"
        />
      </PopoverTrigger>
      <PopoverSurface>
        <div>{t('Common.Offline')}</div>
      </PopoverSurface>
    </Popover>
  );

  return (
    <aside
      className={`app-sidebar shadow-md md:shadow-none z-20 flex-shrink-0 ${
        sidebar.collapsed ? 'w-20 collapsed' : 'w-64 md:w-[17rem]'
      } fixed inset-y-0 top-0 left-0 md:left-0
      flex flex-col duration-300 h-full md:relative transition-all`}
      style={glassStyles}
    >
      {/* Glass reflection effect */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-white opacity-20"></div>
      
      {/* WiFi and Feedback positioned to the right of traffic lights - only show when not collapsed */}
      {!sidebar.collapsed && (
        <div 
          className="absolute flex items-center gap-1"
          style={{ 
            top: '10px', 
            left: '110px', // Move further to the right
            zIndex: 999,
          }}
        >
          {/* WiFi Status */}
          {NetworkStatusIcon}
          
          {/* Feedback Button */}
          <Tooltip 
            content="Give Feedback! (Alt+F)"
            relationship="label"
          >
            <Button
              appearance="transparent"
              icon={<FeedbackIcon />}
              size="small"
              onClick={() => {
                window.electron?.openExternal?.('https://omni-os.canny.io/omni');
              }}
              aria-label="Give Feedback!"
            >
              {t('Common.Feedback')}
            </Button>
          </Tooltip>
        </div>
      )}
      
      {/* Main content flex container */}
      <div className="flex h-full flex-col relative z-10">
        {/* Top global navigation section - Fixed Height */} 
        <div className="flex-shrink-0 pt-10"> 
          <GlobalNav collapsed={sidebar.collapsed} />
        </div>
        
        {/* Middle scrollable content - Takes Remaining Height */} 
        <div className="flex-1 overflow-y-auto mb-1 min-h-0"> {/* Added min-h-0 */} 
          {renderNav()}
        </div>
        
        {/* Fixed Bottom Section (Footer Only) - Fixed Height */} 
        <div className="flex-shrink-0 border-t border-base">
          {/* Removed Feedback button section */}
          
          {/* Footer */}
          <Footer collapsed={sidebar.collapsed} />
        </div>
      </div>
    </aside>
  );
}
