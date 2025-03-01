import { Input, Button, InputOnChangeData } from '@fluentui/react-components';
import { Search24Regular, ArrowUpload24Regular } from '@fluentui/react-icons';
import useNav from 'hooks/useNav';
import { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Empty from 'renderer/components/Empty';
import ImportPromptDialog from 'renderer/components/ImportPromptDialog';
import usePromptStore from 'stores/usePromptStore';
import Grid from './Grid';
import useToast from 'hooks/useToast';

export default function Prompts() {
  const { t } = useTranslation();
  const navigate = useNav();
  const prompts = usePromptStore((state) => state.prompts);
  const fetchPrompts = usePromptStore((state) => state.fetchPrompts);
  const createPrompt = usePromptStore((state) => state.createPrompt);
  const { notifySuccess, notifyError } = useToast();
  const [keyword, setKeyword] = useState<string>('');
  const [importDialogOpen, setImportDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchPrompts({ keyword });
  }, [keyword, fetchPrompts]);

  const onKeywordChange = (
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setKeyword(data.value || '');
  };
  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t('Common.Prompts')}</h1>
          <div className="flex justify-end w-full items-center gap-2">
            <Button
              appearance="secondary"
              onClick={() => setImportDialogOpen(true)}
            >
              {t('Common.Import')}
            </Button>
            <Button
              appearance="primary"
              onClick={() => navigate('/prompts/form')}
            >
              {t('Common.New')}
            </Button>
            <Input
              contentBefore={<Search24Regular />}
              placeholder={t('Common.Search')}
              value={keyword}
              onChange={onKeywordChange}
              style={{ maxWidth: 288 }}
              className="flex-grow flex-shrink"
            />
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        {prompts.length ? (
          <div className="mr-5 flex justify-start gap-2 flex-wrap">
            <Grid prompts={prompts} keyword={keyword} />
          </div>
        ) : (
          <Empty image="design" text={t('Prompt.Info.Empty')} />
        )}
      </div>
      <ImportPromptDialog
        open={importDialogOpen}
        setOpen={setImportDialogOpen}
        onImport={async (promptsData) => {
          try {
            // Handle both single prompt or array of prompts
            const promptsArray = Array.isArray(promptsData) ? promptsData : [promptsData];
            
            console.log(`Received ${promptsArray.length} prompts to import`);
            let importedCount = 0;
            let failedCount = 0;
            
            // Process each prompt
            for (const promptData of promptsArray) {
              try {
                // Remove internal fields that should not be imported
                const { id, createdAt, updatedAt, pinedAt, ...cleanPromptData } = promptData;
                
                // Create a properly structured prompt for import
                const newPrompt = {
                  // Required fields
                  name: cleanPromptData.name,
                  
                  // Content fields
                  systemMessage: cleanPromptData.systemMessage,
                  userMessage: cleanPromptData.userMessage,
                  
                  // Configuration fields (only include if they have valid values)
                  ...(typeof cleanPromptData.maxTokens === 'number' && { maxTokens: cleanPromptData.maxTokens }),
                  ...(typeof cleanPromptData.temperature === 'number' && { temperature: cleanPromptData.temperature }),
                  
                  // Array fields
                  systemVariables: cleanPromptData.systemVariables,
                  userVariables: cleanPromptData.userVariables,
                  models: cleanPromptData.models
                };
                
                // Verify the prompt has at least one message type
                if (!newPrompt.systemMessage && !newPrompt.userMessage) {
                  console.warn(`Skipping prompt "${newPrompt.name}": ${t('Prompt.Notifications.MessageRequired')}`);
                  failedCount++;
                  continue;
                }
                
                // Log the structure being created
                console.log(`Creating prompt "${newPrompt.name}"`);
                
                // Create the prompt in the database
                const createdPrompt = await createPrompt(newPrompt);
                console.log(`Prompt "${newPrompt.name}" created successfully with ID: ${createdPrompt.id}`);
                importedCount++;
              } catch (promptError) {
                console.error(`Error importing prompt "${promptData.name}":`, promptError);
                failedCount++;
              }
            }
            
            // Refresh the prompts list
            await fetchPrompts({ keyword });
            
            // Show appropriate success message
            if (importedCount > 0 && failedCount > 0) {
              notifySuccess(t('Common.ImportPartialSuccess', { 
                imported: importedCount, 
                failed: failedCount 
              }));
            } else if (importedCount > 0) {
              notifySuccess(importedCount === 1 
                ? t('Common.ImportSuccess') 
                : t('Common.ImportMultipleSuccess', { count: importedCount }));
            } else {
              notifyError(t('Common.ImportAllFailed'));
            }
          } catch (error) {
            console.error('Import error:', error);
            notifyError(t('Common.ImportError') + 
              (error instanceof Error ? ': ' + error.message : ''));
          }
        }}
      />
    </div>
  );
}
