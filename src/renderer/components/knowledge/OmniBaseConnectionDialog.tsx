import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Input,
  Spinner,
  DialogOpenChangeEvent,
  DialogOpenChangeData,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useKnowledgeStore from 'stores/useKnowledgeStore';

interface OmniBaseConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function OmniBaseConnectionDialog({
  open,
  onOpenChange,
  onSuccess,
}: OmniBaseConnectionDialogProps) {
  const { t } = useTranslation();
  const { testOmniBaseConnection, createOmniBaseCollection } = useKnowledgeStore();
  const [name, setName] = useState('');
  const [indexName, setIndexName] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleClose = () => {
    onOpenChange(false);
    // Clear form when closing
    setName('');
    setIndexName('');
    setMessage(null);
  };

  const handleOpenChange = (event: DialogOpenChangeEvent, data: DialogOpenChangeData) => {
    if (!data.open) {
      handleClose();
    }
  };

  const handleTest = async () => {
    if (!indexName) {
      setMessage({ type: 'error', text: t('Knowledge.OmniBaseIndexRequired') });
      return;
    }

    setTesting(true);
    setMessage(null);

    try {
      const result = await testOmniBaseConnection(indexName);
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: t('Knowledge.OmniBaseConnectionError') });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: t('Knowledge.OmniBaseConnectionError')
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name) {
      setMessage({ type: 'error', text: t('Knowledge.OmniBaseNameRequired') });
      return;
    }

    if (!indexName) {
      setMessage({ type: 'error', text: t('Knowledge.OmniBaseIndexRequired') });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const collection = await createOmniBaseCollection(
        name,
        indexName
      );

      if (collection) {
        onSuccess && onSuccess();
        handleClose();
      } else {
        setMessage({ 
          type: 'error', 
          text: t('Knowledge.OmniBaseCreateError') 
        });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: t('Knowledge.OmniBaseCreateError') 
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={handleOpenChange}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  onClick={handleClose}
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            {t('Knowledge.SyncWithOmniBase')}
          </DialogTitle>
          <DialogContent>
            <div className="space-y-4">
              <p className="text-sm mb-4">
                {t('Knowledge.OmniBaseDescription')}
              </p>
              
              <div>
                <label className="block text-sm mb-1">
                  {t('Knowledge.CollectionName')} *
                </label>
                <Input
                  value={name}
                  onChange={(_, data) => setName(data.value)}
                  placeholder={t('Knowledge.EnterCollectionName')}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">
                  {t('Knowledge.IndexName')} *
                </label>
                <Input
                  value={indexName}
                  onChange={(_, data) => setIndexName(data.value)}
                  placeholder={t('Knowledge.EnterIndexName')}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This sets the OMNIBASE index name for retrieving information.
                </p>
              </div>

              {message && (
                <div
                  className={`p-2 text-sm rounded ${
                    message.type === 'success'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="flex justify-between gap-4 pt-4">
                <Button
                  appearance="outline"
                  disabled={!indexName || testing || saving}
                  onClick={handleTest}
                >
                  {testing ? <Spinner size="tiny" /> : t('Common.Test')}
                </Button>
                <Button
                  appearance="primary"
                  disabled={!name || !indexName || testing || saving}
                  onClick={handleSave}
                >
                  {saving ? <Spinner size="tiny" /> : t('Common.Save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
} 