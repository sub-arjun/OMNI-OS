import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bundleIcon,
  Shield20Filled,
  Shield20Regular,
} from '@fluentui/react-icons';

const ShieldIcon = bundleIcon(
  Shield20Filled,
  Shield20Regular
);

export default function UncensoredStatusIndicator(
  props: {
    provider: string;
    providerDisplayName?: string;
    model: string;
    withTooltip?: boolean;
  } & any,
) {
  const { provider, providerDisplayName, model, withTooltip, ...rest } = props;
  const { getChatModel } = useProvider();

  const hasUncensoredCapability = useMemo(() => {
    // Only check if model has uncensoredEnabled flag set to true
    const modelConfig = getChatModel(provider, model);
    return !!modelConfig.uncensoredEnabled;
  }, [provider, model]);

  const { t } = useTranslation();
  const tip = t('Uncensored.Supported').replace(
    '{provider}', 
    providerDisplayName || provider
  );

  const indicator = () => {
    if (!hasUncensoredCapability) {
      return null;
    }

    return (
      <div 
        className="flex text-center justify-center items-center"
        style={{ 
          width: 16, 
          height: 16, 
          minWidth: 16,
          marginRight: 1
        }}
      >
        <ShieldIcon 
          className="text-red-500 dark:text-red-400" 
          style={{ 
            color: '#ef4444', /* Red-500 for better visibility */
            width: '15px',
            height: '15px'
          }}
          {...rest}
        />
      </div>
    );
  };

  if (!hasUncensoredCapability) {
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