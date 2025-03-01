import {
  Switch,
  SwitchOnChangeData,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  PopoverProps,
  Button,
} from '@fluentui/react-components';
import { useState, ChangeEvent, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useChatStore from 'stores/useChatStore';
import Debug from 'debug';

import { IChat, IChatContext } from 'intellichat/types';
import { Stream20Filled } from '@fluentui/react-icons';

const debug = Debug('OMNI-OS:pages:chat:Editor:Toolbar:StreamCtrl');

export default function StreamCtrl({ ctx, chat }: { ctx: IChatContext, chat: IChat}) {
  const { t } = useTranslation();

  const editStage = useChatStore((state) => state.editStage);
  const [stream, setStream] = useState<boolean>(true);

  const updateStream = (
    ev: ChangeEvent<HTMLInputElement>,
    data: SwitchOnChangeData
  ) => {
    const $stream = data.checked;
    editStage(chat.id, {stream: $stream})
    window.electron.ingestEvent([
      { app: 'toggle-stream', stream: $stream ? 'on' : 'off' },
    ]);
  };

  const [open, setOpen] = useState<boolean>(false);

  const handleOpenChange: PopoverProps['onOpenChange'] = (e, data) =>
    setOpen(data.open || false);

  const renderLabel = () => {
    return (
      <label className="text-xs">
        {stream
          ? t('Editor.Toolbar.StreamEnabled')
          : t('Editor.Toolbar.StreamDisabled')}
      </label>
    );
  };

  useEffect(() => {
    setStream(ctx.isStream());
  }, [ctx]);

  return (
    <Popover open={open} trapFocus withArrow onOpenChange={handleOpenChange}>
      <PopoverTrigger disableButtonEnhancement>
        <Button
          size="small"
          aria-label={t('Editor.Toolbar.StreamMode')}
          appearance="subtle"
          icon={<Stream20Filled />}
          className="justify-start inline-block text-color-secondary"
          style={{ padding: 1, minWidth: 20 }}
        >
          {stream ? 'on' : 'off'}
        </Button>
      </PopoverTrigger>
      <PopoverSurface aria-labelledby="temperature">
        <div className="w-56">
          <Switch
            checked={stream}
            label={renderLabel()}
            onChange={updateStream}
          />
        </div>
      </PopoverSurface>
    </Popover>
  );
}
