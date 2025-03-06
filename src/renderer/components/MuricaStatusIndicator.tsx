import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Custom American Flag SVG component
const AmericanFlagIcon = (props: any) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* White background */}
    <rect x="0" y="0" width="14" height="14" fill="white" />
    
    {/* Blue rectangle (canton) */}
    <rect x="0" y="0" width="6" height="7" fill="#002868" />
    
    {/* Just 3 minimal stars */}
    <circle cx="1.75" cy="2.33" r="0.5" fill="white" />
    <circle cx="4.25" cy="2.33" r="0.5" fill="white" />
    <circle cx="3" cy="4.66" r="0.5" fill="white" />
    
    {/* Just 5 red stripes for minimalism */}
    <rect x="6" y="0" width="8" height="1.4" fill="#BF0A30" />
    <rect x="6" y="2.8" width="8" height="1.4" fill="#BF0A30" />
    <rect x="6" y="5.6" width="8" height="1.4" fill="#BF0A30" />
    <rect x="0" y="8.4" width="14" height="1.4" fill="#BF0A30" />
    <rect x="0" y="11.2" width="14" height="1.4" fill="#BF0A30" />
  </svg>
);

export default function MuricaStatusIndicator(
  props: {
    provider: string;
    providerDisplayName?: string;
    model: string;
    withTooltip?: boolean;
  } & any,
) {
  const { provider, providerDisplayName, model, withTooltip, ...rest } = props;
  const { getChatModel } = useProvider();

  const hasMuricaCapability = useMemo(() => {
    // Only check if model has muricaEnabled flag set to true
    const modelConfig = getChatModel(provider, model);
    return !!modelConfig.muricaEnabled;
  }, [provider, model]);

  const { t } = useTranslation();
  const tip = t('Murica.Supported').replace(
    '{provider}', 
    providerDisplayName || provider
  );

  const indicator = () => {
    if (!hasMuricaCapability) {
      return null;
    }

    return (
      <div 
        className="flex text-center justify-center items-center"
        style={{ 
          width: 15, 
          height: 15, 
          minWidth: 15,
          marginRight: 1
        }}
      >
        <AmericanFlagIcon {...rest} />
      </div>
    );
  };

  if (!hasMuricaCapability) {
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