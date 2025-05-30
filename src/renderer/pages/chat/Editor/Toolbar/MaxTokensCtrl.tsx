import {
  Button,
  Field,
  SpinButton,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  SpinButtonChangeEvent,
  SpinButtonOnChangeData,
  PopoverProps,
  Tooltip,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  NumberSymbolSquare20Filled,
  NumberSymbolSquare20Regular,
} from '@fluentui/react-icons';
import Debug from 'debug';
import { IChat, IChatContext } from 'intellichat/types';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useChatStore from 'stores/useChatStore';
import { str2int } from 'utils/util';
import { MAX_TOKENS } from 'consts';

const debug = Debug('OMNI-OS:pages:chat:Editor:Toolbar:MaxTokensCtrl');

const NumberSymbolSquareIcon = bundleIcon(
  NumberSymbolSquare20Filled,
  NumberSymbolSquare20Regular,
);

export default function MaxTokens({
  ctx,
  chat,
  onConfirm,
}: {
  ctx: IChatContext;
  chat: IChat;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(false);
  const editStage = useChatStore((state) => state.editStage);

  // Get the model's actual maximum limit (not the default)
  const modelMaxTokens = useMemo<number>(() => {
    const model = ctx.getModel();
    // Use maxTokens as the upper limit, fallback to defaultMaxTokens, then MAX_TOKENS
    return model.maxTokens || model.defaultMaxTokens || MAX_TOKENS;
  }, [chat.model]);

  const [maxTokens, setMaxTokens] = useState<number>(1);

  useEffect(() => {
    Mousetrap.bind('mod+shift+4', () => {
      setOpen((prevOpen) => {
        return !prevOpen;
      });
    });
    // Use the current max tokens from context or default to model max tokens
    const currentMaxTokens = ctx.getMaxTokens();
    setMaxTokens(currentMaxTokens);
    return () => {
      Mousetrap.unbind('mod+shift+4');
    };
  }, [chat.id, modelMaxTokens]);

  const handleOpenChange: PopoverProps['onOpenChange'] = (e, data) =>
    setOpen(data.open || false);

  const updateMaxTokens = (
    ev: SpinButtonChangeEvent,
    data: SpinButtonOnChangeData,
  ) => {
    const value = data.value
      ? data.value
      : str2int(data.displayValue as string);
    const $maxToken = Math.max(Math.min(value as number, modelMaxTokens), 1);
    editStage(chat.id, { maxTokens: $maxToken });
    setMaxTokens($maxToken);
    onConfirm();
    window.electron.ingestEvent([{ app: 'modify-max-tokens' }]);
  };

  return (
    <Popover withArrow trapFocus open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger disableButtonEnhancement>
        <Tooltip
          content={
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.MaxTokens')}</div>
              <div>{t('Tooltip.MaxTokensDesc')} {t('Tooltip.MaxTokensShortcut')}</div>
              <div style={{ marginTop: '3px', fontSize: '12px' }}>
                {t('Tooltip.CurrentValue', { value: maxTokens > 0 ? maxTokens : 'Default' })}
              </div>
            </div>
          }
          relationship="description"
          positioning="above"
        >
          <Button
            size="small"
            appearance="subtle"
            aria-label={t('Common.MaxTokens')}
            icon={<NumberSymbolSquareIcon className="mr-0" />}
            className="justify-center text-color-secondary flex-shrink-0"
            style={{
              padding: 1,
              minWidth: 30,
              borderColor: 'transparent',
              boxShadow: 'none',
            }}
          >
            <span className="latin">{maxTokens > 0 ? maxTokens : '_'}</span>
          </Button>
        </Tooltip>
      </PopoverTrigger>
      <PopoverSurface aria-labelledby="max tokens">
        <div className="w-64 flex flex-col items-center p-2">
          <Field
            label={t('Common.MaxTokens') + ' (≤' + modelMaxTokens + ')'}
            style={{ borderColor: 'transparent', boxShadow: 'none' }}
            className="w-full flex flex-col items-center"
          >
            <SpinButton
              precision={0}
              step={1}
              min={1}
              max={modelMaxTokens}
              value={maxTokens}
              id="maxTokens"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }
              }}
              placeholder={`${t('Common.NoMoreThan') as string} ${modelMaxTokens}`}
              onChange={updateMaxTokens}
              className="mb-1"
            />
          </Field>
          <div className="mt-1.5 text-xs tips text-center">
            {t(`Toolbar.Tip.MaxTokens`)}
          </div>
        </div>
      </PopoverSurface>
    </Popover>
  );
}
