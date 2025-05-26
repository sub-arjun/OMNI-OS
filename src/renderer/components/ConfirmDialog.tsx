import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogTrigger,
  DialogBody,
  Button,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import { useTranslation } from 'react-i18next';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useCallback, useEffect } from 'react';
import React from 'react';

export default function ConfirmDialog(args: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}) {
  const { open, setOpen, onConfirm, title, message } = args;
  const confirmButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const { t } = useTranslation();
  const confirm = useCallback(() => {
    async function confirmAndClose() {
      await onConfirm();
      setOpen(false);
    }
    confirmAndClose();
  }, [setOpen, onConfirm]);

  const handleOpenChange = useCallback((event: any, data: any) => {
    setOpen(data.open);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setTimeout(() => confirmButtonRef.current?.focus(), 200);
      Mousetrap.bind('esc', ()=>setOpen(false))
    }
    return ()=>{
      Mousetrap.unbind('esc')
    }
  }, [open, setOpen]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  onClick={() => setOpen(false)}
                  appearance="subtle"
                  aria-label="close"
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            {title || t('Common.DeleteConfirmation')}
          </DialogTitle>
          <DialogContent>
            {message || t('Common.DeleteConfirmationInfo')}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="subtle" onClick={() => setOpen(false)}>
                {t('Common.Cancel')}
              </Button>
            </DialogTrigger>
            <DialogTrigger disableButtonEnhancement>
              <Button
                appearance="primary"
                onClick={() => confirm()}
                ref={confirmButtonRef}
              >
                {t('Common.Delete')}
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
