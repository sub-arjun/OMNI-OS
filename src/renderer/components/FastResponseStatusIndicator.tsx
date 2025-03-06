import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bundleIcon,
  Flash20Filled,
  Flash20Regular,
} from '@fluentui/react-icons';

const LightningIcon = bundleIcon(
  Flash20Filled,
  Flash20Regular
);

export default function FastResponseStatusIndicator(
  props: {
    provider: string;
    providerDisplayName?: string;
    model: string;
    withTooltip?: boolean;
  } & any,
) {
  const { provider, providerDisplayName, model, withTooltip, ...rest } = props;
  const { getChatModel } = useProvider();

  const hasFastResponseCapability = useMemo(() => {
    // Only check if model has fastResponseEnabled flag set to true
    const chatModel = getChatModel(provider, model);
    return !!chatModel.fastResponseEnabled;
  }, [provider, model]);

  const { t } = useTranslation();
  const tip = t('FastResponse.Supported').replace(
    '{provider}', 
    providerDisplayName || provider
  );

  const indicator = () => {
    if (!hasFastResponseCapability) {
      return null;
    }

    // Use a standard styling for all fast response models
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
        <LightningIcon 
          className="text-yellow-500 dark:text-yellow-400" 
          style={{ 
            color: '#f59e0b', /* Yellow-500 for better visibility */
            width: '15px',
            height: '15px'
          }}
          {...rest}
        />
      </div>
    );
  };

  if (!hasFastResponseCapability) {
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