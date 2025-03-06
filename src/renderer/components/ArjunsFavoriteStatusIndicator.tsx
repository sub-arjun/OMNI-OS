import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bundleIcon,
  Heart20Filled,
  Heart20Regular,
} from '@fluentui/react-icons';

const HeartIcon = bundleIcon(
  Heart20Filled,
  Heart20Regular
);

export default function ArjunsFavoriteStatusIndicator(
  props: {
    provider: string;
    providerDisplayName?: string;
    model: string;
    withTooltip?: boolean;
  } & any,
) {
  const { provider, providerDisplayName, model, withTooltip, ...rest } = props;
  const { getChatModel } = useProvider();

  const hasArjunsFavoriteCapability = useMemo(() => {
    // Only check if model has arjunsFavoriteEnabled flag set to true
    const modelConfig = getChatModel(provider, model);
    return !!modelConfig.arjunsFavoriteEnabled;
  }, [provider, model]);

  const { t } = useTranslation();
  const tip = t('ArjunsFavorite.Supported').replace(
    '{provider}', 
    providerDisplayName || provider
  );

  const indicator = () => {
    if (!hasArjunsFavoriteCapability) {
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
        <HeartIcon 
          className="text-purple-500 dark:text-purple-400" 
          style={{ 
            color: '#8b5cf6', /* Purple for Arjun's favorite */
            width: '15px',
            height: '15px'
          }}
          {...rest}
        />
      </div>
    );
  };

  if (!hasArjunsFavoriteCapability) {
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