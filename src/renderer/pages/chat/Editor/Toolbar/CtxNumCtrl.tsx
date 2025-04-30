import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Field,
  Label,
  Slider,
  SliderOnChangeData,
  PopoverProps,
  Tooltip,
} from '@fluentui/react-components';
import {
  bundleIcon,
  History20Regular,
  History20Filled,
} from '@fluentui/react-icons';
import { useState, ChangeEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useChatStore from 'stores/useChatStore';
import Debug from 'debug';
import { IChat, IChatContext } from 'intellichat/types';
import useSettingsStore from 'stores/useSettingsStore';
import Mousetrap from 'mousetrap';
import { isNumber } from 'lodash';
import { MIN_CTX_MESSAGES, MAX_CTX_MESSAGES, NUM_CTX_MESSAGES } from 'consts';

const debug = Debug('OMNI-OS:pages:chat:Editor:Toolbar:CtxNumCtrl');

const HistoryIcon = bundleIcon(History20Filled, History20Regular);

export default function CtxNumCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(false);
  const providerName = useSettingsStore((state) => state.api).provider;
  const editStage = useChatStore((state) => state.editStage);
  const [ctxMessages, setCtxMessages] = useState<number>(NUM_CTX_MESSAGES);

  const handleOpenChange: PopoverProps['onOpenChange'] = (e, data) =>
    setOpen(data.open || false);

  const updateCtxMessages = (
    ev: ChangeEvent<HTMLInputElement>,
    data: SliderOnChangeData,
  ) => {
    const maxCtxMessages = data.value;
    setCtxMessages(maxCtxMessages);
    editStage(chat.id, { maxCtxMessages });
    window.electron.ingestEvent([
      { app: 'modify-max-ctx-messages' },
      { 'max-ctx-messages': maxCtxMessages },
    ]);
  };

  useEffect(() => {
    Mousetrap.bind('mod+shift+6', () =>
      setOpen((prevOpen) => {
        return !prevOpen;
      }),
    );
    setCtxMessages(
      isNumber(chat.maxCtxMessages) ? chat.maxCtxMessages : NUM_CTX_MESSAGES,
    );
    return () => {
      Mousetrap.unbind('mod+shift+6');
    };
  }, [providerName, chat.id]);

  return (
    <Popover trapFocus withArrow open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger disableButtonEnhancement>
        <Tooltip
          content={
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.MaxNumOfContextMessages')}</div>
              <div>{t('Tooltip.CtxNumDesc')} {t('Tooltip.CtxNumShortcut')}</div>
              <div style={{ marginTop: '3px', fontSize: '12px' }}>
                {t('Tooltip.CurrentMessages', { count: ctxMessages })}
              </div>
            </div>
          }
          relationship="description"
          positioning="above"
        >
          <Button
            size="small"
            icon={<HistoryIcon />}
            aria-label={t('Common.MaxNumOfContextMessages')}
            appearance="subtle"
            style={{ borderColor: 'transparent', boxShadow: 'none' }}
            className="text-color-secondary justify-center"
          >
            {ctxMessages}
          </Button>
        </Tooltip>
      </PopoverTrigger>
      <PopoverSurface aria-labelledby="temperature">
        <div className="w-80 flex flex-col items-center p-2">
          <Field
            label={`${t('Common.MaxNumOfContextMessages')} (${ctxMessages})`}
            className="w-full"
          >
            <div className="flex items-center p-1.5 w-full">
              <Label aria-hidden>{MIN_CTX_MESSAGES}</Label>
              <Slider
                id="chat-max-context"
                step={1}
                min={MIN_CTX_MESSAGES}
                max={MAX_CTX_MESSAGES}
                value={ctxMessages}
                className="flex-grow mx-2"
                onChange={updateCtxMessages}
              />
              <Label aria-hidden>{MAX_CTX_MESSAGES}</Label>
            </div>
          </Field>
        </div>
      </PopoverSurface>
    </Popover>
  );
}
