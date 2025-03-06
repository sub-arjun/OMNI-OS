import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bundleIcon,
  Search16Filled,
  Search16Regular,
} from '@fluentui/react-icons';

const SearchIcon = bundleIcon(
  Search16Filled,
  Search16Regular
);

export default function SearchStatusIndicator(
  props: {
    provider: string;
    model: string;
    withTooltip?: boolean;
    compact?: boolean;
  } & any,
) {
  const { provider, model, withTooltip, compact = false, ...rest } = props;
  const { getChatModel } = useProvider();

  const hasOnlineAccess = useMemo(() => {
    // Check if model has online access capabilities defined in the provider
    return getChatModel(provider, model).onlineEnabled || false;
  }, [provider, model]);

  const { t } = useTranslation();
  const tip = "This model can search the web for up-to-date information";

  const indicator = () => {
    if (!hasOnlineAccess) {
      return null;
    }

    return (
      <div 
        className="flex text-center justify-center items-center text-blue-500 dark:text-blue-400"
        style={{ 
          width: compact ? 14 : 16, 
          height: compact ? 14 : 16, 
          minWidth: compact ? 14 : 16, 
          marginRight: 1,
          marginLeft: compact ? 2 : 0
        }}
      >
        <SearchIcon 
          className="text-blue-500 dark:text-blue-400" 
          style={{ 
            color: '#3b82f6', /* Blue-500 for better visibility */
            width: compact ? '14px' : '16px',
            height: compact ? '14px' : '16px'
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