import React, { useState } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  makeStyles,
  Textarea,
  Text
} from '@fluentui/react-components';
import { 
  DocumentText24Regular
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { IMCPConfig } from '../../types/mcp';

const useStyles = makeStyles({
  textArea: {
    width: '100%',
    height: '300px',
    fontFamily: 'monospace',
    fontSize: '14px'
  },
  tabContent: {
    padding: '16px 0',
  },
  errorMessage: {
    color: 'var(--colorStatusDangerForeground1)',
    marginTop: '8px'
  },
  warningMessage: {
    color: 'var(--colorStatusWarningForeground1)',
    marginBottom: '16px'
  }
});

interface ImportMCPConfigDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onImport: (config: IMCPConfig) => void;
}

const ImportMCPConfigDialog = ({ open, setOpen, onImport }: ImportMCPConfigDialogProps) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonText(e.target.value);
    setError('');
  };

  const handleImport = async () => {
    try {
      if (!jsonText.trim()) {
        setError(t('Common.ImportError'));
        return;
      }
      
      const configData: IMCPConfig = JSON.parse(jsonText);
      
      // Validate that it's a valid MCP config
      if (!configData.servers || !Array.isArray(configData.servers)) {
        setError(t('MCP.ImportError.InvalidConfig'));
        return;
      }
      
      // Validate each server in the config
      for (const server of configData.servers) {
        if (!server.key || !server.command) {
          setError(t('MCP.ImportError.InvalidServer'));
          return;
        }
      }
      
      // Import the config
      onImport(configData);
      setOpen(false);
      setJsonText('');
    } catch (error) {
      console.error('Import error:', error);
      setError(t('Common.ImportError'));
    }
  };

  const handleDialogClose = () => {
    setOpen(false);
    setError('');
    setJsonText('');
  };

  return (
    <Dialog open={open} onOpenChange={(e, data) => handleDialogClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t('MCP.ImportConfig')}</DialogTitle>
          <DialogContent>
            <Text className={styles.warningMessage}>
              {t('MCP.ImportWarning')}
            </Text>
            
            <div className={styles.tabContent}>
              <Textarea
                className={styles.textArea}
                placeholder={t('MCP.PasteConfigHere')}
                value={jsonText}
                onChange={handleTextChange}
              />
              {error && <Text className={styles.errorMessage}>{error}</Text>}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={handleDialogClose}>
              {t('Common.Cancel')}
            </Button>
            <Button appearance="primary" onClick={handleImport}>
              {t('Common.Import')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};

export default ImportMCPConfigDialog; 