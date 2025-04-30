import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tooltip
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  QuestionCircle20Regular,
  ArrowRight16Regular,
  ArrowLeft16Regular,
  Alert20Regular,
  PanelLeft20Regular,
  PanelRight20Regular,
  PanelLeft20Filled,
  PanelRight20Filled,
  bundleIcon
} from '@fluentui/react-icons';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useAppearanceStore from 'stores/useAppearanceStore';
import useAuthStore from 'stores/useAuthStore';
import useNav from 'hooks/useNav';
import useToast from 'hooks/useToast';
import { createPortal } from 'react-dom';

// Add type declaration for Canny
declare global {
  interface Window {
    Canny?: (method: string, options?: any) => void;
    attachEvent?: (event: string, callback: () => void) => void;
  }
}

// Bundle the sidebar icons
const SidebarCollapseIcon = bundleIcon(PanelLeft20Filled, PanelLeft20Regular);
const SidebarExpandIcon = bundleIcon(PanelRight20Filled, PanelRight20Regular);

// Preload Canny script immediately - outside of component lifecycle
// This ensures it starts loading as soon as this file is imported
(function preloadCannySDK() {
  if (document.getElementById('canny-jssdk')) {
    return; // Already loaded
  }
  
  try {
    // Create script element and start loading SDK
    const script = document.createElement('script') as HTMLScriptElement;
    script.id = 'canny-jssdk';
    script.src = "https://cdn.canny.io/sdk.js";
    script.async = true;
    
    // Add to document head to begin loading
    document.head.appendChild(script);
    console.log('Canny SDK preloading started');
  } catch (error) {
    console.error('Error preloading Canny SDK:', error);
  }
})();

export default function Footer({ collapsed }: { collapsed: boolean }) {
  // Add fallback values and optional chaining for store access
  const toggleSidebarCollapsed = useAppearanceStore(
    (state) => state?.toggleSidebarCollapsed || (() => {})
  );
  const theme = useAppearanceStore((state) => state?.theme || 'light');
  const { t } = useTranslation();
  const cannyInitialized = useRef(false);
  const [cannyLoadFailed, setCannyLoadFailed] = useState(false);
  const [cannyReady, setCannyReady] = useState(false);
  const [showEula, setShowEula] = useState(false);
  
  // Determine if dark mode is active, with fallback handling
  const isDarkMode = useMemo(() => {
    try {
      return theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
    } catch (err) {
      console.error('Error detecting dark mode:', err);
      return false;
    }
  }, [theme]);
  
  // Update isDarkMode when system preference changes
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        // Force re-render when system theme changes
        setShowEula(prev => {
          if (prev) return prev; // Only re-render if EULA is showing
          return prev;
        });
      };
      
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);
  
  const goYouTube = useCallback(() => {
    window.electron.openExternal('https://www.youtube.com/@OMNI-OS');
    window.electron.ingestEvent([{ app: 'go-youtube' }]);
  }, []);

  const goAbout = useCallback(() => {
    window.electron.openExternal('https://becomeomni.com');
    window.electron.ingestEvent([{ app: 'go-homepage' }]);
  }, []);

  const goEULA = useCallback(() => {
    setShowEula(true);
    window.electron.ingestEvent([{ app: 'view-eula' }]);
  }, []);

  // Initialize Canny once SDK is loaded
  useEffect(() => {
    const initCanny = () => {
      // If already initialized, just update our state
      if (cannyInitialized.current) {
        setCannyReady(true);
        return;
      }
      
      // Check if SDK is loaded
      if (window.Canny) {
        try {
          window.Canny('initChangelog', {
            appID: '67ad3367817e8854c1d4665b',
            position: 'top',
            align: 'left',
            theme: 'auto',
          });
          cannyInitialized.current = true;
          setCannyReady(true);
          console.log('Canny changelog initialized');
        } catch (error) {
          console.error('Error initializing Canny:', error);
          setCannyLoadFailed(true);
        }
      } else {
        // SDK not loaded yet, check again in 100ms
        setTimeout(initCanny, 100);
      }
    };
    
    // Start initialization process
    initCanny();
    
    // Set up keyboard shortcut
    Mousetrap.bind('mod+t', () => toggleSidebarCollapsed());
    
    return () => {
      Mousetrap.unbind('mod+t');
    };
  }, [toggleSidebarCollapsed]);

  // Handle clicks when Canny failed to load or isn't ready yet
  const handleChangelogClick = () => {
    if (cannyLoadFailed) {
      // Open the external changelog URL if Canny failed to load
      window.electron?.openExternal?.('https://omni-os.canny.io/changelog');
      return;
    }
    
    // Only attempt to show if Canny is ready and the function exists
    if (cannyReady && window.Canny) {
      try {
        window.Canny('showChangelog');
      } catch (error) {
        console.error('Error calling Canny showChangelog:', error);
        // Optionally, fallback to external link if the call fails
        // window.electron?.openExternal?.('https://omni-os.canny.io/changelog');
      }
    } else {
      console.warn('Canny SDK not ready or available when trying to show changelog.');
      // Optionally, provide fallback behavior like opening the external link
      // window.electron?.openExternal?.('https://omni-os.canny.io/changelog');
    }
  };

  return (
    <>
      <div
        className={`flex w-full items-center justify-between self-baseline border-t border-base bg-brand-sidebar px-6 py-1 ${
          collapsed ? 'flex-col' : ''
        }`}
      >
        <button
          data-canny-changelog
          type="button"
          onClick={handleChangelogClick}
          className={`flex items-center gap-x-1 rounded-md px-2 py-1 text-xs font-medium text-brand-secondary outline-none hover:bg-brand-surface-1 hover:text-brand-base ${
            collapsed ? 'hidden' : ''
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
              className={`flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium text-brand-secondary outline-none hover:bg-brand-surface-1 hover:text-brand-base ${
                collapsed ? 'hidden' : ''
              }`}
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                    <line x1="9" y1="11" x2="15" y2="11" />
                  </svg>
                }
                onClick={goEULA}
              >
                EULA
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

        <Tooltip
          content={`${collapsed ? 'Expand' : 'Collapse'} Sidebar (Ctrl+T)`}
          relationship="description"
        >
          <button
            type="button"
            className={`hidden items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium outline-none md:flex ${
              collapsed ? 'w-full justify-center' : 'justify-start'
            }`}
            onClick={() => toggleSidebarCollapsed()}
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              border: '1px solid rgba(var(--color-border), 0.2)',
              backgroundColor: 'rgba(var(--color-bg-surface-2), 0.4)',
              borderRadius: '6px',
              transition: 'background-color 0.2s ease, border-color 0.2s ease'
            }}
            onMouseOver={(e) => {
              // Use a standard surface background color on hover
              e.currentTarget.style.backgroundColor = 'rgba(var(--color-bg-surface-2), 0.8)'; 
              e.currentTarget.style.borderColor = 'rgba(var(--color-border), 0.3)'; // Keep a subtle border highlight
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--color-bg-surface-2), 0.4)'; 
              e.currentTarget.style.borderColor = 'rgba(var(--color-border), 0.2)'; 
            }}
          >
            {collapsed ? <SidebarExpandIcon fontSize={20} /> : <SidebarCollapseIcon fontSize={20} />}
            {!collapsed && <span className="ml-1">Collapse</span>}
          </button>
        </Tooltip>
        <div className="relative" />
      </div>

      {/* EULA Modal */}
      {showEula && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className={`max-w-4xl w-full mx-4 rounded-lg shadow-xl max-h-[90vh] flex flex-col ${
            isDarkMode ? 'bg-brand-surface-1 text-brand-base' : 'bg-white text-gray-900'
          }`}>
            <div className={`p-4 border-b flex justify-between items-center ${
              isDarkMode ? 'bg-brand-surface-2 border-brand-divider text-brand-base' : 'bg-gray-100 border-gray-200'
            }`}>
              <h2 className="text-xl font-semibold">{t('Common.EULA')}</h2>
              <button 
                onClick={() => setShowEula(false)}
                className={
                  isDarkMode 
                    ? 'text-brand-secondary hover:text-brand-base transition-colors' 
                    : 'text-gray-500 hover:text-gray-700'
                }
              >
                ✕
              </button>
            </div>
            <div className={`p-6 overflow-y-auto flex-grow ${
              isDarkMode ? 'bg-brand-surface-1' : 'bg-white'
            }`}>
              <pre className="whitespace-pre-wrap font-sans text-sm">
{`END USER LICENSE AGREEMENT (EULA) FOR OMNI

IMPORTANT: PLEASE READ THIS END USER LICENSE AGREEMENT CAREFULLY BEFORE USING OMNI SOFTWARE.

This End User License Agreement ("Agreement") is a legal agreement between you (either an individual or a single entity) and Omniscience Labs INC ("Company") for the OMNI software product, which includes computer software and may include associated media, printed materials, and "online" or electronic documentation ("SOFTWARE PRODUCT"). By installing, copying, or otherwise using the SOFTWARE PRODUCT, you agree to be bound by the terms of this Agreement. If you do not agree to the terms of this Agreement, do not install or use the SOFTWARE PRODUCT.

1. GRANT OF LICENSE
The SOFTWARE PRODUCT is licensed, not sold. This Agreement grants you the following rights:
a. Installation and Use: You may install and use an unlimited number of copies of the SOFTWARE PRODUCT for development and testing purposes only.
b. Reproduction and Distribution: You may NOT reproduce or distribute the SOFTWARE PRODUCT.

2. DESCRIPTION OF OTHER RIGHTS AND LIMITATIONS
a. Maintenance of Copyright Notices: You must not remove or alter any copyright notices on any copy of the SOFTWARE PRODUCT.
b. Distribution: You may not distribute copies of the SOFTWARE PRODUCT to third parties.
c. Rental: You may not rent, lease, or lend the SOFTWARE PRODUCT.
d. Support Services: Company may provide you with support services related to the SOFTWARE PRODUCT ("Support Services"). Any supplemental software code provided to you as part of the Support Services shall be considered part of the SOFTWARE PRODUCT and subject to the terms and conditions of this Agreement.
e. Compliance with Applicable Laws: You must comply with all applicable laws regarding use of the SOFTWARE PRODUCT.
f. Development Use Only: This SOFTWARE PRODUCT is provided for development and testing purposes only and is not intended for production use.

3. TERMINATION
Without prejudice to any other rights, Company may terminate this Agreement if you fail to comply with the terms and conditions of this Agreement. In such event, you must destroy all copies of the SOFTWARE PRODUCT in your possession.

4. COPYRIGHT
All title, including but not limited to copyrights, in and to the SOFTWARE PRODUCT and any copies thereof are owned by Company or its suppliers. All title and intellectual property rights in and to the content which may be accessed through use of the SOFTWARE PRODUCT is the property of the respective content owner and may be protected by applicable copyright or other intellectual property laws and treaties. This Agreement grants you no rights to use such content.

5. NO WARRANTIES
Company expressly disclaims any warranty for the SOFTWARE PRODUCT, which is provided 'AS IS' without any express or implied warranty of any kind, including but not limited to any warranties of merchantability, non-infringement, or fitness for a particular purpose. Company does not warrant or assume responsibility for the accuracy or completeness of any information, text, graphics, links, or other items contained within the SOFTWARE PRODUCT. Company makes no warranties respecting any harm that may be caused by the transmission of a computer virus, worm, time bomb, logic bomb, or other such computer program.

6. LIMITATION OF LIABILITY
In no event shall Company be liable for any damages (including, without limitation, lost profits, business interruption, or lost information) rising out of the use of or inability to use the SOFTWARE PRODUCT, even if Company has been advised of the possibility of such damages. In no event will Company be liable for loss of data or for indirect, special, incidental, consequential (including lost profit), or other damages based in contract, tort, or otherwise. Company shall have no liability with respect to the content of the SOFTWARE PRODUCT or any part thereof, including but not limited to errors or omissions contained therein, libel, infringements of rights of publicity, privacy, trademark rights, business interruption, personal injury, loss of privacy, moral rights, or the disclosure of confidential information.

7. BETA SOFTWARE
The SOFTWARE PRODUCT is a pre-release, beta version. It may contain bugs, errors, and other problems that could cause system or other failures and data loss. The SOFTWARE PRODUCT may be substantially modified before commercial release or may never be commercially released.

8. DATA COLLECTION
You agree that Company may collect and use technical information gathered as part of the Support Services provided to you, if any, related to the SOFTWARE PRODUCT. Company may use this information solely to improve its products or to provide customized services or technologies to you and will not disclose this information in a form that personally identifies you.

9. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Delaware, USA, without regard to conflicts of law provisions.

10. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between you and Company relating to the SOFTWARE PRODUCT and supersedes all prior or contemporaneous understandings regarding such subject matter.

© 2024 Omniscience Labs INC. All rights reserved.`}
              </pre>
            </div>
            <div className={`p-4 border-t flex justify-end ${
              isDarkMode ? 'bg-brand-surface-2 border-brand-divider' : 'bg-gray-100 border-gray-200'
            }`}>
              <button 
                onClick={() => setShowEula(false)}
                className={`px-4 py-2 rounded transition-colors ${
                  isDarkMode 
                    ? 'bg-brand-surface-3 hover:bg-brand-surface-4 text-brand-base' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                {t('Common.OK')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
