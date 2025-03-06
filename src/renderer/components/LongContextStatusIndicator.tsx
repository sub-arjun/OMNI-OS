import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bundleIcon,
  TextExpand20Filled,
  TextExpand20Regular,
} from '@fluentui/react-icons';

const TextExpandIcon = bundleIcon(
  TextExpand20Filled,
  TextExpand20Regular
);

export default function LongContextStatusIndicator(
  props: {
    provider: string;
    model: string;
    withTooltip?: boolean;
  } & any,
) {
  const { provider, model, withTooltip, ...rest } = props;
  const { getChatModel } = useProvider();

  const hasLongContextCapability = useMemo(() => {
    // Check if model has longContextEnabled flag set to true
    const modelConfig = getChatModel(provider, model);
    return !!modelConfig.longContextEnabled;
  }, [provider, model]);

  const { t } = useTranslation();
  const tip = t('LongContext.Supported');

  const indicator = () => {
    if (!hasLongContextCapability) {
      return null;
    }

    return (
      <div 
        className="flex text-center justify-center items-center text-blue-500 dark:text-blue-400"
        style={{ width: 16, height: 16, minWidth: 16, marginRight: 1 }}
      >
        <TextExpandIcon 
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

  if (!hasLongContextCapability) {
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