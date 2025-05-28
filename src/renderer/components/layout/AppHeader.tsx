import {
  Button,
} from '@fluentui/react-components';
import {
  PanelLeftText24Filled,
  PanelLeftText24Regular,
  bundleIcon,
} from '@fluentui/react-icons';
import useAppearanceStore from '../../../stores/useAppearanceStore';
import './AppHeader.scss';
import TrafficLights from '../TrafficLights';

const PanelLeftIcon = bundleIcon(PanelLeftText24Filled, PanelLeftText24Regular);

export default function AppHeader() {
  const collapsed = useAppearanceStore((state) => state?.sidebar?.collapsed || false);
  const toggleSidebarVisibility = useAppearanceStore(
    (state) => state?.toggleSidebarVisibility || (() => {})
  );

  return (
    <div
      className={`app-header z-30 ${collapsed ? 'pl-20' : 'pl-20 md:pl-[17rem]'} pt-3 flex items-center transition-all duration-300`}
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
    </div>
  );
}
