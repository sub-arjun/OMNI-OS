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
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useAppearanceStore from 'stores/useAppearanceStore';

export default function Footer({ collapsed }: { collapsed: boolean }) {
  const toggleSidebarCollapsed = useAppearanceStore(
    (state) => state.toggleSidebarCollapsed
  );
  const { t } = useTranslation();
  
  const goYouTube = useCallback(() => {
    window.electron.openExternal('https://www.youtube.com/@OMNI-OS');
    window.electron.ingestEvent([{ app: 'go-youtube' }]);
  }, []);

  const goAbout = useCallback(() => {
    window.electron.openExternal('https://becomeomni.com');
    window.electron.ingestEvent([{ app: 'go-homepage' }]);
  }, []);

  useEffect(() => {
    Mousetrap.bind('mod+t', () => toggleSidebarCollapsed());
    //@ts-ignore
    const canny = window?.Canny;
    if (canny) {
      canny('initChangelog', {
        appID: '67ad3367817e8854c1d4665b',
        position: 'top',
        align: 'left',
        theme: 'auto',
      });
    }
    return () => {
      Mousetrap.unbind('mod+t');
    };
  }, []);

  return (
    <div
      className={`flex w-full items-center justify-between self-baseline border-t border-base bg-brand-sidebar px-6 py-2 ${
        collapsed ? 'flex-col' : ''
      }`}
    >
      <button
        data-canny-changelog
        type="button"
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
            className={`flex items-center gap-x-1 rounded-md px-2 py-2 text-xs font-medium text-brand-primary outline-none bg-brand-surface-1/70 border border-brand-primary/40 shadow-sm hover:bg-brand-surface-1 hover:text-brand-base ${
              collapsed ? 'w-full justify-center' : ''
            }`}
            title={t('Common.Help')}
          >
            <QuestionCircle20Regular className="text-brand-primary" />
            {collapsed ? '' : <span className="font-semibold">{t('Common.Help')}</span>}
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
            <MenuItem
              onClick={() => {
                window.electron.openExternal('https://omni-os.canny.io/omni');
                window.electron.ingestEvent([{ app: 'go-feedback' }]);
              }}
            >
              <div className="flex items-center w-full p-1.5 rounded bg-brand-surface-1/50 border border-brand-primary/30">
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
                  className="text-brand-primary mr-2"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                <span className="font-bold text-brand-primary">Feedback</span>
              </div>
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
