import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bundleIcon,
  BrainCircuit20Filled,
  BrainCircuit20Regular,
} from '@fluentui/react-icons';

const BrainIcon = bundleIcon(
  BrainCircuit20Filled,
  BrainCircuit20Regular
);

export default function ReasoningStatusIndicator(
  props: {
    provider: string;
    model: string;
    withTooltip?: boolean;
  } & any,
) {
  const { provider, model, withTooltip, ...rest } = props;
  const { getChatModel } = useProvider();

  const hasReasoningCapability = useMemo(() => {
    // Only check if model has reasoningEnabled flag set to true
    const modelConfig = getChatModel(provider, model);
    return !!modelConfig.reasoningEnabled;
  }, [provider, model]);

  const { t } = useTranslation();
  const tip = t('Reasoning.Supported');

  const indicator = () => {
    if (!hasReasoningCapability) {
      return null;
    }

    return (
      <div 
        className="flex text-center justify-center items-center text-purple-500 dark:text-purple-400"
        style={{ width: 16, height: 16, minWidth: 16, marginRight: 1 }}
      >
        <BrainIcon 
          className="text-purple-500 dark:text-purple-400" 
          style={{ 
            color: '#8b5cf6', /* Purple-500 for better visibility */
            width: '16px',
            height: '16px'
          }}
          {...rest}
        />
      </div>
    );
  };

  if (!hasReasoningCapability) {
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