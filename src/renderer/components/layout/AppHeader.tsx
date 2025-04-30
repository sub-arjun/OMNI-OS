import { useEffect, useState } from 'react';
import {
  Button,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tooltip,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  PanelLeftText24Filled,
  PanelLeftText24Regular,
  Wifi124Filled,
  Wifi124Regular,
  WifiOff24Filled,
  WifiOff24Regular,
  bundleIcon,
} from '@fluentui/react-icons';
import useOnlineStatus from 'hooks/useOnlineStatus';
import { useTranslation } from 'react-i18next';
import useAppearanceStore from '../../../stores/useAppearanceStore';
import './AppHeader.scss';
import TrafficLights from '../TrafficLights';
import { FeedbackIcon } from './aside/GlobalNav';

const PanelLeftIcon = bundleIcon(PanelLeftText24Filled, PanelLeftText24Regular);
const OnlineIcon = bundleIcon(Wifi124Filled, Wifi124Regular);
const OfflineIcon = bundleIcon(WifiOff24Filled, WifiOff24Regular);

export default function AppHeader() {
  const collapsed = useAppearanceStore((state) => state?.sidebar?.collapsed || false);
  const toggleSidebarVisibility = useAppearanceStore(
    (state) => state?.toggleSidebarVisibility || (() => {})
  );
  const { t } = useTranslation();
  const theme = useAppearanceStore((state) => state?.theme || 'light');

  const NetworkStatusIcon = useOnlineStatus() ? (
    <Popover withArrow size="small" closeOnScroll>
      <PopoverTrigger disableButtonEnhancement>
        <Button 
          icon={<OnlineIcon />} 
          appearance="transparent" 
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} 
        />
      </PopoverTrigger>
      <PopoverSurface>
        <div> {t('Common.Online')}</div>
      </PopoverSurface>
    </Popover>
  ) : (
    <Popover withArrow size="small" closeOnScroll>
      <PopoverTrigger disableButtonEnhancement>
        <Button 
          icon={<OfflineIcon />} 
          appearance="transparent" 
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} 
        />
      </PopoverTrigger>
      <PopoverSurface>
        <div> {t('Common.Offline')}</div>
      </PopoverSurface>
    </Popover>
  );

  useEffect(() => {
    Mousetrap.bind('alt+f', () => {
      window.electron?.openExternal?.('https://omni-os.canny.io/omni');
      return false;
    });
    return () => {
      Mousetrap.unbind('alt+f');
    };
  }, []);

  return (
    <div
      className={`app-header z-30 pl-20 pt-3 flex items-center`}
    >
      <TrafficLights></TrafficLights>
      <div className="block md:hidden pl-1">
        <Button
          icon={<PanelLeftIcon />}
          appearance="transparent"
          onClick={() => toggleSidebarVisibility()}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        />
      </div>
      <div className="pl-0.5">{NetworkStatusIcon}</div>
      <div className="pl-0.5 -ml-2">
        <Tooltip 
          content="Give Feedback! (Alt+F)"
          relationship="label"
        >
          <Button
            appearance="transparent"
            icon={<FeedbackIcon />}
            size="medium"
            onClick={() => {
              window.electron?.openExternal?.('https://omni-os.canny.io/omni');
            }}
            aria-label="Give Feedback!"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} 
          >
            {t('Common.Feedback')}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
