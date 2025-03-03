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
  TabList,
  Tab,
  Text
} from '@fluentui/react-components';
import { 
  ArrowDownload24Regular,
  ArrowUpload24Regular
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';

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
  }
});

interface ImportPromptDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onImport: (promptData: any) => void;
}

const ImportPromptDialog = ({ open, setOpen, onImport }: ImportPromptDialogProps) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('paste');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setError('');
  };

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
      let inputData;
      
      if (activeTab === 'paste') {
        if (!jsonText.trim()) {
          setError(t('Common.ImportError'));
          return;
        }
        
        // Handle the case where the input might be multiple JSON objects separated by commas
        let textToProcess = jsonText.trim();
        
        // Check if the text starts with [ and ends with ], which would indicate it's already an array
        if (!(textToProcess.startsWith('[') && textToProcess.endsWith(']'))) {
          // If it's not an array, check if it might be comma-separated objects
          // Wrap in array brackets if it contains multiple objects (contains '{' followed by '},{')
          if (textToProcess.includes('},{')) {
            textToProcess = '[' + textToProcess + ']';
          }
        }
        
        inputData = JSON.parse(textToProcess);
      } else {
        if (!selectedFile) {
          setError(t('Common.ImportError'));
          return;
        }
        const text = await selectedFile.text();
        inputData = JSON.parse(text);
      }
      
      // Convert to array if it's a single object
      const promptsArray = Array.isArray(inputData) ? inputData : [inputData];
      
      console.log(`Processing ${promptsArray.length} prompts`);
      
      // Array to store normalized prompts
      const normalizedPrompts = [];
      
      // Process each prompt
      for (const promptData of promptsArray) {
        // Validate the prompt structure
        if (!promptData.name) {
          setError(t('Common.ImportError') + ': ' + t('Notification.NameRequired') + ` (${promptData.name || 'unnamed prompt'})`);
          return;
        }
        
        // Log raw fields to help debug
        console.log(`Processing prompt "${promptData.name}":`, {
          systemMessage: promptData.systemMessage ? `${promptData.systemMessage.length} chars` : 'missing',
          userMessage: promptData.userMessage ? `${promptData.userMessage.length} chars` : 'missing',
        });
        
        // At least one of system message or user message must be present
        if ((!promptData.systemMessage || promptData.systemMessage.trim() === '') && 
            (!promptData.userMessage || promptData.userMessage.trim() === '')) {
          setError(t('Common.ImportError') + ': ' + t('Prompt.Notifications.MessageRequired') + ` (${promptData.name})`);
          return;
        }
        
        // Ensure all fields are properly normalized with correct types
        const normalizedPrompt = {
          // Required fields
          name: promptData.name,
          
          // Content fields with safety defaults
          systemMessage: promptData.systemMessage || "",
          userMessage: promptData.userMessage || "",
          
          // Configuration fields with proper type handling
          maxTokens: typeof promptData.maxTokens === 'number' ? promptData.maxTokens : undefined,
          temperature: typeof promptData.temperature === 'number' ? promptData.temperature : undefined,
          
          // Array fields with proper type handling
          systemVariables: Array.isArray(promptData.systemVariables) ? [...promptData.systemVariables] : [],
          userVariables: Array.isArray(promptData.userVariables) ? [...promptData.userVariables] : [],
          models: Array.isArray(promptData.models) ? [...promptData.models] : []
        };
        
        // Log comprehensive information for debugging
        console.log(`Normalized prompt "${promptData.name}":`, {
          systemMessage: `${normalizedPrompt.systemMessage.length} chars`,
          userMessage: `${normalizedPrompt.userMessage.length} chars`,
          maxTokens: normalizedPrompt.maxTokens,
          temperature: normalizedPrompt.temperature,
          systemVariables: normalizedPrompt.systemVariables.length + ' items',
          userVariables: normalizedPrompt.userVariables.length + ' items',
          models: normalizedPrompt.models.length + ' models'
        });

        normalizedPrompts.push(normalizedPrompt);
      }
      
      console.log(`Successfully normalized ${normalizedPrompts.length} prompts for import`);
      
      // Send all normalized prompts to the parent component
      onImport(normalizedPrompts);
      setOpen(false);
      setJsonText('');
      setSelectedFile(null);
    } catch (error) {
      console.error('Import error:', error);
      setError(t('Common.ImportError'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t('Common.Import')}</DialogTitle>
          <DialogContent>
            <div>
              <TabList selectedValue={activeTab} onTabSelect={(event, data) => handleTabChange(data.value as string)}>
                <Tab value="paste">{t('Common.Paste')}</Tab>
                <Tab value="upload">{t('Common.Upload')}</Tab>
              </TabList>
              <div className={styles.tabContent}>
                {activeTab === 'paste' ? (
                  <Textarea
                    className={styles.textArea}
                    placeholder={t('Common.PasteJsonHere')}
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
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setOpen(false)}>
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

export default ImportPromptDialog; 