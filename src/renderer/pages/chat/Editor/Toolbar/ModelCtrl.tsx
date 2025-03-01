import {
  Button,
  Menu,
  MenuCheckedValueChangeData,
  MenuCheckedValueChangeEvent,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Text,
  Tooltip,
  Switch,
  SwitchProps,
} from '@fluentui/react-components';
import { ChevronDown16Regular, Info16Regular } from '@fluentui/react-icons';
import Mousetrap from 'mousetrap';
import { IChat, IChatContext } from 'intellichat/types';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useChatStore from 'stores/useChatStore';
import useSettingsStore from 'stores/useSettingsStore';
import { IChatModel, ProviderType } from 'providers/types';
import useProvider from 'hooks/useProvider';
import useAuthStore from 'stores/useAuthStore';
import ToolStatusIndicator from 'renderer/components/ToolStatusIndicator';
import { isUndefined } from 'lodash';

// Custom styled Switch component with green color when checked
const GreenSwitch = (props: SwitchProps) => {
  return (
    <Switch 
      {...props}
      className={`${props.className || ''} ${props.checked ? 'green-switch' : ''}`}
      style={{
        ...(props.style || {}),
        ...(props.checked ? {
          '--switch-indicator-checked-background': '#2ecc71',
          '--switch-indicator-checked-border': '#27ae60',
          '--colorCompoundBrandBackground': '#2ecc71',
          '--colorBrandBackground': '#2ecc71',
          '--colorNeutralForegroundOnBrand': '#ffffff',
          '--colorBrandBackgroundHover': '#27ae60',
          '--colorBrandBackgroundPressed': '#27ae60',
          '--colorCompoundBrandBackgroundHover': '#27ae60',
          '--colorCompoundBrandBackgroundPressed': '#27ae60',
        } as React.CSSProperties : {})
      }}
    />
  );
};

export default function ModelCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const api = useSettingsStore((state) => state.api);
  const modelMapping = useSettingsStore((state) => state.modelMapping);
  const { getToolState, setToolState } = useSettingsStore();
  const autoOMNIEnabled = useSettingsStore((state) => state.autoOMNIEnabled);
  const setAutoOMNIEnabled = useSettingsStore((state) => state.setAutoOMNIEnabled);
  const session = useAuthStore((state) => state.session);
  const { getProvider, getChatModels } = useProvider();
  const [providerName, setProviderName] = useState<ProviderType>(api.provider);
  const editStage = useChatStore((state) => state.editStage);

  const allModels = useMemo<IChatModel[]>(() => {
    if (!api.provider || api.provider === 'Azure') return [];
    const provider = getProvider(api.provider);
    setProviderName(provider.name);
    if (provider.chat.options.modelCustomizable) {
      return getChatModels(provider.name) || [];
    }
    return [];
  }, [api.provider, session]);

  const autoModel = useMemo(() => {
    return allModels.find(model => model.autoEnabled === true);
  }, [allModels]);

  const models = useMemo<IChatModel[]>(() => {
    // If AutoOMNI is enabled and exists, only show the auto model
    if (autoOMNIEnabled && autoModel) {
      return [autoModel];
    }
    // Otherwise show all models except the auto model
    return allModels.filter(model => !model.autoEnabled);
  }, [allModels, autoOMNIEnabled, autoModel]);

  const activeModel = useMemo(() => ctx.getModel(), [chat.model]);

  const onModelChange = (
    _: MenuCheckedValueChangeEvent,
    data: MenuCheckedValueChangeData,
  ) => {
    const $model = data.checkedItems[0];
    editStage(chat.id, { model: $model });
    window.electron.ingestEvent([{ app: 'switch-model' }, { model: $model }]);
    // Don't close dialog when changing model selection
    // closeDialog();
  };

  const toggleDialog = () => {
    if (open) {
      closeDialog();
    } else {
      openDialog();
    }
  };

  const openDialog = () => {
    setOpen(true);
    Mousetrap.bind('esc', closeDialog);
  };

  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind('esc');
  };

  const toggleAutoOMNI = () => {
    const newState = !autoOMNIEnabled;
    setAutoOMNIEnabled(newState);
    
    // If turning AutoOMNI on, switch to the auto model
    if (newState && autoModel) {
      editStage(chat.id, { model: autoModel.label });
    } 
    // If turning AutoOMNI off and currently using the auto model,
    // switch to the first non-auto model
    else if (!newState && activeModel.autoEnabled && models.length > 0) {
      editStage(chat.id, { model: models[0].label });
    }
    
    // Don't close the dialog when toggling AutoOMNI
    // closeDialog();
  };

  useEffect(() => {
    if (models.length > 0) {
      Mousetrap.bind('mod+shift+1', toggleDialog);
    }
    return () => {
      Mousetrap.unbind('mod+shift+1');
    };
  }, [models]);

  return models && models.length ? (
    <Menu
      hasCheckmarks
      open={open}
      onCheckedValueChange={onModelChange}
      checkedValues={{ model: [activeModel.label as string] }}
    >
      <MenuTrigger disableButtonEnhancement>
        <Button
          aria-label={t('Common.Model')}
          size="small"
          appearance="subtle"
          iconPosition="after"
          icon={<ChevronDown16Regular />}
          title="Mod+Shift+1"
          onClick={toggleDialog}
          style={{ borderColor: 'transparent', boxShadow: 'none', padding: 1 }}
          className="text-color-secondary flex justify-start items-center"
        >
          <div className="flex flex-row justify-start items-center mr-1">
            <ToolStatusIndicator
              provider={providerName}
              model={activeModel.name}
              withTooltip={true}
            />
          </div>
          <div className="flex-shrink overflow-hidden whitespace-nowrap text-ellipsis min-w-12">
            <span className="text-color-secondary">{providerName} /</span>
            <span className="font-medium">{activeModel.label}</span>
            {modelMapping[activeModel.label || ''] && (
              <span className="text-gray-300 dark:text-gray-600">
                ‣{modelMapping[activeModel.label || '']}
              </span>
            )}
            {activeModel.description && (
              <Tooltip
                content={activeModel.description as string}
                relationship="label"
              >
                <Button
                  icon={<Info16Regular />}
                  size="small"
                  appearance="subtle"
                />
              </Tooltip>
            )}
          </div>
        </Button>
      </MenuTrigger>
      <MenuPopover className="model-menu-popup">
        <MenuList style={{ width: '450px' }}>
          {autoModel && (
            <div className="px-2 py-2 mb-2 border-b border-gray-200 dark:border-gray-700">
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 500, textAlign: 'center' }}>&nbsp;&nbsp;✨ AutoOMNI ✨</span>
                  <div style={{ flexShrink: 0 }}>
                    <GreenSwitch checked={autoOMNIEnabled} onChange={toggleAutoOMNI} />
                  </div>
                </div>
                <div style={{ paddingLeft: '4px' }}>
                  <span style={{ fontSize: '0.9rem' }}>🪄 AI Selects Best Model 🪄</span>
                </div>
                <div style={{ paddingLeft: '4px' }}>
                  <span style={{ fontSize: '0.9rem' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(Experimental)</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Manual model selection title */}
          {!autoOMNIEnabled && (
            <div className="px-3 py-2 mb-2">
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Manual Model Selection</span>
            </div>
          )}
          
          {/* Only show non-auto models */}
          {!autoOMNIEnabled && allModels.filter(model => !model.autoEnabled).map((item) => {
            let toolEnabled = getToolState(providerName, item.name);
            if (isUndefined(toolEnabled)) {
              toolEnabled = item.toolEnabled;
            }
            return (
              <MenuItemRadio
                name="model"
                value={item.label as string}
                key={item.label}
              >
                <div className="flex justify-start items-baseline gap-1">
                  <ToolStatusIndicator
                    provider={providerName}
                    model={item.name}
                  />
                  <span className="latin">{item.label}</span>
                  {modelMapping[item.label || ''] && (
                    <span className="text-gray-300 dark:text-gray-600 -ml-1">
                      ‣{modelMapping[item.label || '']}
                    </span>
                  )}
                  {item.description && (
                    <Tooltip
                      content={item.description as string}
                      relationship="label"
                    >
                      <Button
                        icon={<Info16Regular />}
                        size="small"
                        appearance="subtle"
                      />
                    </Tooltip>
                  )}
                </div>
              </MenuItemRadio>
            );
          })}
        </MenuList>
      </MenuPopover>
    </Menu>
  ) : (
    <Text size={200}>
      <span className="flex justify-start items-center gap-1">
        <div>
          <ToolStatusIndicator
            provider={providerName}
            model={activeModel.name}
          />
        </div>
        <span className="latin">
          <span className="text-color-secondary">{api.provider} / </span>
          <span className="font-medium">{activeModel.label}</span>
        </span>
        {modelMapping[activeModel.label || ''] && (
          <span className="text-gray-300 dark:text-gray-600 -ml-1">
            ‣{modelMapping[activeModel.label || '']}
          </span>
        )}
      </span>
    </Text>
  );
}


