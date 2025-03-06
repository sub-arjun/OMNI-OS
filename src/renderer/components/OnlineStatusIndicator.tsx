import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bundleIcon,
  Wifi124Filled,
  Wifi124Regular,
} from '@fluentui/react-icons';

const WifiIcon = bundleIcon(
  Wifi124Filled,
  Wifi124Regular
);

export default function OnlineStatusIndicator(
  props: {
    provider: string;
    providerDisplayName?: string;
    model: string;
    withTooltip?: boolean;
  } & any,
) {
  const { provider, providerDisplayName, model, withTooltip, ...rest } = props;
  const { getChatModel } = useProvider();

  const hasOnlineAccess = useMemo(() => {
    // Check if model has online access capabilities defined in the provider
    return getChatModel(provider, model).onlineEnabled || false;
  }, [provider, model]);

  const { t } = useTranslation();
  // Use providerDisplayName in tooltip if available
  const tip = t('Online.Supported').replace(
    '{provider}', 
    providerDisplayName || provider
  );

  const indicator = () => {
    if (!hasOnlineAccess) {
      return null;
    }

    return (
      <div 
        className="flex text-center justify-center items-center text-blue-500 dark:text-blue-400"
        style={{ width: 16, height: 16, minWidth: 16, marginRight: 1 }}
      >
        <WifiIcon 
          className="text-blue-500 dark:text-blue-400" 
          style={{ 
            color: '#3b82f6', /* Blue-500 for better visibility */
            width: '16px',
            height: '16px'
          }}
          {...rest}
        />
      </div>
    );
  };

  if (!hasOnlineAccess) {
    return null;
  }

  return withTooltip ? (
    <Tooltip
      content={{
        children: tip,
      }}
      positioning="above-start"
      withArrow
      relationship="label"
    >
      {indicator()}
    </Tooltip>
  ) : (
    indicator()
  );
} 