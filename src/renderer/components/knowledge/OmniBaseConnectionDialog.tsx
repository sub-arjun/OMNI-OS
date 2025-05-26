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
import { useState, useCallback, useRef, useEffect } from 'react';
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
  const [namespace, setNamespace] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [isValid, setIsValid] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const resetForm = useCallback(() => {
    if (!isMounted.current) return;
    setName('');
    setIndexName('');
    setNamespace('');
    setValidationMessage('');
    setIsValid(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleOpenChange = useCallback((event: DialogOpenChangeEvent, data: DialogOpenChangeData) => {
    if (!data.open) {
      resetForm();
    }
    onOpenChange(data.open);
  }, [onOpenChange, resetForm]);

  const handleTest = async () => {
    if (!indexName) {
      setValidationMessage(t('Knowledge.OmniBaseIndexRequired'));
      return;
    }

    setIsValidating(true);
    setValidationMessage('');

    try {
      const result = await testOmniBaseConnection(indexName);
      
      if (result.success) {
        setValidationMessage(result.message);
      } else {
        setValidationMessage(t('Knowledge.OmniBaseConnectionError'));
      }
    } catch (error: any) {
      setValidationMessage(t('Knowledge.OmniBaseConnectionError'));
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!name) {
      setValidationMessage(t('Knowledge.OmniBaseNameRequired'));
      return;
    }

    if (!indexName) {
      setValidationMessage(t('Knowledge.OmniBaseIndexRequired'));
      return;
    }

    setIsValidating(true);
    setValidationMessage('');

    try {
      const collection = await createOmniBaseCollection(
        name,
        indexName
      );

      if (collection) {
        onSuccess && onSuccess();
        handleClose();
      } else {
        setValidationMessage(t('Knowledge.OmniBaseCreateError'));
      }
    } catch (error: any) {
      setValidationMessage(t('Knowledge.OmniBaseCreateError'));
    } finally {
      setIsValidating(false);
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

              {validationMessage && (
                <div
                  className={`p-2 text-sm rounded ${
                    validationMessage.includes('success')
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {validationMessage}
                </div>
              )}

              <div className="flex justify-between gap-4 pt-4">
                <Button
                  appearance="outline"
                  disabled={!indexName || isValidating}
                  onClick={handleTest}
                >
                  {isValidating ? <Spinner size="tiny" /> : t('Common.Test')}
                </Button>
                <Button
                  appearance="primary"
                  disabled={!name || !indexName || isValidating}
                  onClick={handleSave}
                >
                  {isValidating ? <Spinner size="tiny" /> : t('Common.Save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
} 