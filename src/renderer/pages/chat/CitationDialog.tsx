import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Button,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useKnowledgeStore from 'stores/useKnowledgeStore';

export default function CitationDialog() {
  const { citation } = useKnowledgeStore();
  const { t } = useTranslation();

  const isOpen = useMemo(() => {
    return citation.open;
  }, [citation.open]);

  const close = useCallback(() => {
    useKnowledgeStore.getState().hideCitation();
  }, []);

  const handleOpenChange = useCallback((event: any, data: any) => {
    if (!data.open) {
      close();
    }
  }, [close]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            {t('Citation')}
          </DialogTitle>
          <DialogContent>
            <pre className='max-h-80'>
              {citation.content}
            </pre>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
