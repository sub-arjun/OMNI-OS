import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  QuestionCircle20Regular,
  ArrowRight16Regular,
  ArrowLeft16Regular,
  Alert20Regular,
} from '@fluentui/react-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAppearanceStore from 'stores/useAppearanceStore';

// Add type declaration for Canny
declare global {
  interface Window {
    Canny?: (method: string, options?: any) => void;
    attachEvent?: (event: string, callback: () => void) => void;
  }
}

export default function Footer({ collapsed }: { collapsed: boolean }) {
  const toggleSidebarCollapsed = useAppearanceStore(
    (state) => state.toggleSidebarCollapsed
  );
  const { t } = useTranslation();
  const cannyInitialized = useRef(false);
  const [cannyLoadFailed, setCannyLoadFailed] = useState(false);
  
  const goYouTube = useCallback(() => {
    window.electron.openExternal('https://www.youtube.com/@OMNI-OS');
    window.electron.ingestEvent([{ app: 'go-youtube' }]);
  }, []);

  const goAbout = useCallback(() => {
    window.electron.openExternal('https://becomeomni.com');
    window.electron.ingestEvent([{ app: 'go-homepage' }]);
  }, []);

  // Load Canny script on component mount
  useEffect(() => {
    const loadCannyScript = () => {
      if (cannyInitialized.current || document.getElementById('canny-jssdk')) {
        return; // Already loaded or initialized
      }
      
      try {
        // Use the official Canny loader snippet
        // This creates a queue for commands until the SDK is fully loaded
        (function(w: Window, d: Document, i: string, s: string) {
          function l() {
            if (!d.getElementById(i)) {
              const f = d.getElementsByTagName(s)[0];
              const e = d.createElement(s) as HTMLScriptElement;
              e.id = i;
              e.src = "https://cdn.canny.io/sdk.js";
              e.async = true;
              f.parentNode?.insertBefore(e, f);
              
              // Track failures
              e.onerror = () => {
                console.error('Failed to load Canny SDK');
                setCannyLoadFailed(true);
              };
            }
          }
          
          if (typeof w.Canny !== 'function') {
            const c = function(...args: any[]) {
              (c as any).q.push(args);
            };
            (c as any).q = [];
            w.Canny = c;
            
            if (d.readyState === 'complete') {
              l();
            } else if (w.attachEvent) {
              // Old IE support
              w.attachEvent('onload', l);
            } else {
              w.addEventListener('load', l, false);
            }
          }
        })(window, document, 'canny-jssdk', 'script');
        
        // Initialize the Canny changelog
        // This should happen right after setting up the loader
        // The SDK will queue this command if it's not loaded yet
        if (window.Canny) {
          window.Canny('initChangelog', {
            appID: '67ad3367817e8854c1d4665b',
            position: 'top',
            align: 'left',
            theme: 'auto',
          });
          
          cannyInitialized.current = true;
          console.log('Canny changelog initialized');
        }
      } catch (error) {
        console.error('Error setting up Canny:', error);
        setCannyLoadFailed(true);
      }
    };
    
    // Load Canny as soon as the component mounts
    loadCannyScript();
    
    // Set up keyboard shortcut
    Mousetrap.bind('mod+t', () => toggleSidebarCollapsed());
    
    return () => {
      Mousetrap.unbind('mod+t');
    };
  }, [toggleSidebarCollapsed]);

  // Handle clicks when Canny failed to load
  const handleChangelogClick = () => {
    if (cannyLoadFailed) {
      // Open the external changelog URL if Canny failed to load
      window.electron?.openExternal?.('https://omni-os.canny.io/changelog');
    }
    // When Canny is working, it will automatically handle the click
    // on any element with the data-canny-changelog attribute
  };

  return (
    <div
      className={`flex w-full items-center justify-between self-baseline border-t border-base bg-brand-sidebar px-6 py-2 ${
        collapsed ? 'flex-col' : ''
      }`}
    >
      <button
        data-canny-changelog
        type="button"
        onClick={handleChangelogClick}
        className={`flex items-center gap-x-1 rounded-md px-2 py-2 text-xs font-medium text-brand-secondary outline-none hover:bg-brand-surface-1 hover:text-brand-base ${
          collapsed ? 'w-full justify-center' : ''
        }`}
        title="Changelog"
        aria-label="changelog"
      >
        <Alert20Regular />
      </button>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <button
            type="button"
            className={`flex items-center justify-center rounded-md px-2 py-2 text-xs font-medium text-brand-secondary outline-none hover:bg-brand-surface-1 hover:text-brand-base`}
            title={t('Common.Help')}
          >
            <QuestionCircle20Regular />
          </button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="18"
                  height="18"
                  strokeWidth="1.5"
                >
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"></path>
                </svg>
              }
              onClick={goYouTube}
            >
              {t('Common.YouTube')}
            </MenuItem>
            <MenuItem
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="20"
                  height="20"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
              }
              onClick={goAbout}
            >
              {t('Common.About')}
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      <button
        type="button"
        title="Mod+t"
        className={`hidden items-center gap-3 rounded-md px-2 py-2 text-xs font-medium outline-none hover:bg-brand-surface-1 hover:text-brand-base md:flex ${
          collapsed ? 'w-full justify-center' : ''
        }`}
        onClick={() => toggleSidebarCollapsed()}
      >
        {collapsed ? <ArrowRight16Regular /> : <ArrowLeft16Regular />}
      </button>
      <div className="relative" />
    </div>
  );
}
