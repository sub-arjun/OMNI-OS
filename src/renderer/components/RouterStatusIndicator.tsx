import { Tooltip } from '@fluentui/react-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Simple shuffle icon with crossed arrows
const VerticalShuffleIcon = (props: any) => {
  const { size = '11px', color = 'white', ...rest } = props;
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path 
        d="M3 4h10M3 12h10M5 2L3 4L5 6M11 10l2 2-2 2"
        stroke={color} 
        strokeWidth="1.5" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function RouterStatusIndicator(
  props: {
    provider: string;
    model: string;
    withTooltip?: boolean;
    compact?: boolean;
  } & any,
) {
  const { provider, model, withTooltip, compact = false, ...rest } = props;

  const isAutoRouter = useMemo(() => {
    // Check for Agent02 model
    return model === 'openrouter/auto' || model === 'anthropic/claude-3.7-sonnet:beta';
  }, [model]);

  const { t } = useTranslation();
  const tip = "Agent02 dynamically selects optimal processing for your task";

  const indicator = () => {
    if (!isAutoRouter) {
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
          background: 'linear-gradient(0deg, rgba(79,70,229,1) 0%, rgba(99,102,241,1) 100%)',
          borderRadius: '50%',
        }}
      >
        <VerticalShuffleIcon 
          size={compact ? '10px' : '11px'} 
          color="white" 
          {...rest}
        />
      </div>
    );
  };

  if (!isAutoRouter) {
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