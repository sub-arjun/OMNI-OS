import React, { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  makeStyles,
  Text
} from '@fluentui/react-components';
import { Copy24Regular } from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';

const useStyles = makeStyles({
  codeArea: {
    width: '100%',
    height: '400px',
    backgroundColor: '#f5f5f5',
    padding: '10px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '14px',
    overflowY: 'auto',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#333',
    maxWidth: '100%'
  },
  copyButton: {
    marginRight: 'auto'
  }
});

interface ExportPromptDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  jsonData: string;
}

const ExportPromptDialog = ({ open, setOpen, jsonData }: ExportPromptDialogProps) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  
  // Debug the incoming JSON data when dialog opens
  React.useEffect(() => {
    if (open && jsonData) {
      console.log('ExportPromptDialog received jsonData of length:', jsonData.length);
      try {
        // Parse and log content to make sure data is complete
        const parsedData = JSON.parse(jsonData);
        console.log('Parsed data in dialog:', {
          name: parsedData.name,
          systemMessage: parsedData.systemMessage ? `${parsedData.systemMessage.length} chars` : 'missing',
          userMessage: parsedData.userMessage ? `${parsedData.userMessage.length} chars` : 'missing',
        });
      } catch (e) {
        console.error('Failed to parse JSON in dialog:', e);
      }
    }
  }, [open, jsonData]);

  const copyToClipboard = () => {
    // Always use the fallback method for clipboard copying
    const textarea = document.createElement('textarea');
    textarea.value = jsonData;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(e, data) => setOpen(data.open)}
      modalType="modal"
    >
      <DialogSurface style={{ maxWidth: '800px', width: '80%', maxHeight: '80vh' }}>
        <DialogBody>
          <DialogTitle>{t('Common.Export')}</DialogTitle>
          <DialogContent>
            <pre className={styles.codeArea}>{jsonData}</pre>
          </DialogContent>
          <DialogActions>
            <Button 
              className={styles.copyButton}
              icon={<Copy24Regular />} 
              onClick={copyToClipboard}
              appearance="primary"
            >
              {copied ? t('Common.Notification.Copied') : t('Common.Copy')}
            </Button>
            <Button onClick={() => setOpen(false)}>{t('Common.Close')}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default ExportPromptDialog; 