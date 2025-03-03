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
  Text,
  TabList,
  Tab
} from '@fluentui/react-components';
import { 
  ArrowUpload24Regular,
  DocumentText24Regular,
  Document24Regular
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
  uploadArea: {
    border: '2px dashed #ccc',
    borderRadius: '4px',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: '10px',
    minHeight: '200px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  fileInput: {
    display: 'none'
  },
  warningMessage: {
    color: 'var(--colorStatusWarningForeground1)',
    marginBottom: '16px'
  },
  tabList: {
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
  const [activeTab, setActiveTab] = useState('paste');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonText(e.target.value);
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleImport = async () => {
    try {
      let configData: IMCPConfig;
      
      if (activeTab === 'paste') {
        if (!jsonText.trim()) {
          setError(t('Common.ImportError'));
          return;
        }
        
        configData = JSON.parse(jsonText);
      } else {
        if (!selectedFile) {
          setError(t('Common.ImportError'));
          return;
        }
        const text = await selectedFile.text();
        configData = JSON.parse(text);
      }
      
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
      setSelectedFile(null);
    } catch (error) {
      console.error('Import error:', error);
      setError(t('Common.ImportError'));
    }
  };

  const handleDialogClose = () => {
    setOpen(false);
    setError('');
    setJsonText('');
    setSelectedFile(null);
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
            
            <TabList 
              selectedValue={activeTab}
              onTabSelect={(_, data) => setActiveTab(data.value as string)}
              className={styles.tabList}
            >
              <Tab value="paste" icon={<DocumentText24Regular />}>
                {t('Common.Paste')}
              </Tab>
              <Tab value="upload" icon={<Document24Regular />}>
                {t('Common.Upload')}
              </Tab>
            </TabList>
            
            <div className={styles.tabContent}>
              {activeTab === 'paste' ? (
                <Textarea
                  className={styles.textArea}
                  placeholder={t('MCP.PasteConfigHere')}
                  value={jsonText}
                  onChange={handleTextChange}
                />
              ) : (
                <>
                  <input 
                    type="file" 
                    id="fileInput" 
                    className={styles.fileInput} 
                    accept=".json" 
                    onChange={handleFileChange} 
                  />
                  <div 
                    className={styles.uploadArea} 
                    onClick={() => document.getElementById('fileInput')?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <ArrowUpload24Regular />
                    <Text>
                      {selectedFile 
                        ? selectedFile.name 
                        : t('Common.DropFileHere')}
                    </Text>
                  </div>
                </>
              )}
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