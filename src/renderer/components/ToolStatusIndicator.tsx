import { Tooltip } from '@fluentui/react-components';
import useProvider from 'hooks/useProvider';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSettingsStore from 'stores/useSettingsStore';
import {
  bundleIcon,
  WrenchScrewdriverFilled,
  WrenchScrewdriverRegular,
} from '@fluentui/react-icons';

const WrenchScrewdriverIcon = bundleIcon(
  WrenchScrewdriverFilled,
  WrenchScrewdriverRegular
);

export default function ToolStatusIndicator(
  props: {
    provider: string;
    model: string;
    withTooltip?: boolean;
    compact?: boolean;
  } & any,
) {
  const { provider, model, withTooltip, compact = false, ...rest } = props;
  const { getToolState } = useSettingsStore();
  const { getChatModel } = useProvider();

  const originalSupport = useMemo(
    () => getChatModel(provider, model).toolEnabled || false,
    [provider, model],
  );

  const actualSupport = useMemo(() => {
    let toolEnabled = getToolState(provider, model);
    if (isUndefined(toolEnabled)) {
      toolEnabled = originalSupport;
    }
    return toolEnabled;
  }, [provider, model, originalSupport]);

  const { t } = useTranslation();
  const tip = t(actualSupport ? 'Tool.Supported' : 'Tool.NotSupported');

  const indicator = () => {
    // Only render something if the model has tool support
    if (!actualSupport) {
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
          background: actualSupport 
            ? 'linear-gradient(0deg, rgba(85,177,85,1) 0%, rgba(66,150,66,1) 100%)' 
            : 'linear-gradient(0deg, rgba(200,200,200,0.5) 0%, rgba(180,180,180,0.5) 100%)',
          borderRadius: '50%',
        }}
      >
        <WrenchScrewdriverIcon
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

  // If no tool support and no tooltip needed, return null
  if (!actualSupport && !withTooltip) {
    return null;
  }

  // If tooltip is requested, wrap indicator in tooltip (will be null for non-supported tools)
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
