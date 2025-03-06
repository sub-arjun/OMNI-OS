import { Tooltip } from '@fluentui/react-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bundleIcon,
  ShieldKeyhole20Filled,
  ShieldKeyhole20Regular,
} from '@fluentui/react-icons';

const ShieldIcon = bundleIcon(
  ShieldKeyhole20Filled,
  ShieldKeyhole20Regular
);

export default function SecureStatusIndicator(
  props: {
    provider: string;
    withTooltip?: boolean;
    compact?: boolean;
  } & any,
) {
  const { provider, withTooltip, compact = false, ...rest } = props;

  const isSecureProvider = useMemo(() => {
    // Only show for OMNI provider
    return provider === 'OMNI';
  }, [provider]);

  const { t } = useTranslation();
  const tip = "Models hosted securely in the US with guaranteed no-train policy";

  const indicator = () => {
    if (!isSecureProvider) {
      return null;
    }

    return (
      <div 
        className="flex text-center justify-center items-center text-green-500 dark:text-green-400"
        style={{ 
          width: compact ? 14 : 16, 
          height: compact ? 14 : 16, 
          minWidth: compact ? 14 : 16, 
          marginRight: 1,
          marginLeft: compact ? 2 : 0
        }}
      >
        <ShieldIcon 
          className="text-green-500 dark:text-green-400" 
          style={{ 
            color: '#10b981', /* Green-500 for better visibility */
            width: compact ? '14px' : '16px',
            height: compact ? '14px' : '16px'
          }}
          {...rest}
        />
      </div>
    );
  };

  if (!isSecureProvider) {
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