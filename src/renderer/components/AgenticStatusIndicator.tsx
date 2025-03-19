import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  bundleIcon,
  Bot20Filled,
  Bot20Regular,
} from '@fluentui/react-icons';

const BotIcon = bundleIcon(
  Bot20Filled,
  Bot20Regular
);

export default function AgenticStatusIndicator(
  props: {
    provider: string;
    providerDisplayName?: string;
    model: string;
    withTooltip?: boolean;
    compact?: boolean;
  } & any,
) {
  const { provider, providerDisplayName, model, withTooltip, compact = false, ...rest } = props;
  const { getChatModel } = useProvider();

  const hasAgenticCapability = useMemo(() => {
    // Check if model has agentEnabled flag set to true
    const modelConfig = getChatModel(provider, model);
    return !!modelConfig.agentEnabled;
  }, [provider, model]);

  const { t } = useTranslation();
  const tip = t('Agentic.Supported').replace(
    '{provider}', 
    providerDisplayName || provider
  );

  const indicator = () => {
    if (!hasAgenticCapability) {
      return null;
    }

    return (
      <div 
        className="flex text-center justify-center items-center"
        style={{ 
          width: compact ? 14 : 16, 
          height: compact ? 14 : 16, 
          minWidth: compact ? 14 : 16,
          marginRight: 1,
          marginLeft: compact ? 2 : 0,
          background: 'linear-gradient(0deg, rgba(234,88,12,1) 0%, rgba(249,115,22,1) 100%)',
          borderRadius: '50%',
        }}
      >
        <BotIcon 
          style={{ 
            color: 'white',
            width: compact ? '10px' : '11px',
            height: compact ? '10px' : '11px'
          }}
          {...rest}
        />
      </div>
    );
  };

  if (!hasAgenticCapability) {
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