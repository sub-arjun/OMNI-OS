import {
  Button,
  Divider,
  Field,
  Input,
  Text,
  InputOnChangeData,
  InfoLabel,
  Spinner,
  Tooltip,
  Checkbox,
} from '@fluentui/react-components';
import { BracesVariable20Regular, SparkleRegular } from '@fluentui/react-icons';
import useToast from 'hooks/useToast';
import { IPromptDef } from 'intellichat/types';
import { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import usePromptStore from 'stores/usePromptStore';
import { parseVariables, enhanceSystemPrompt } from 'utils/util';
import { isBlank } from 'utils/validators';

function MessageField({
  label,
  tooltip,
  value,
  onChange,
  variables,
}: {
  label: string;
  tooltip?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  variables: string[];
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const isSystemMessage = label === t('Common.Instructions');
  const [isVariablesSelectorOpen, setIsVariablesSelectorOpen] = useState(false);
  const [enhancingPrompt, setEnhancingPrompt] = useState<boolean>(false);

  const handleEnhanceSystemPrompt = async () => {
    if (!value || typeof value !== 'string' || value.trim() === '') {
      return;
    }
    
    try {
      setEnhancingPrompt(true);
      const enhancedPrompt = await enhanceSystemPrompt(value);
      
      const syntheticEvent = {
        target: {
          value: enhancedPrompt
        }
      } as ChangeEvent<HTMLTextAreaElement>;
      
      onChange(syntheticEvent);
      notifySuccess(t('Common.SystemMessageEnhanced'));
    } catch (error) {
      console.error('Failed to enhance system prompt:', error);
      notifyError(t('Common.EnhanceSystemMessageError'));
    } finally {
      setEnhancingPrompt(false);
    }
  };
  
  return (
    <div className="w-full">
      <Field
        label={tooltip ? <InfoLabel info={tooltip}>{label}</InfoLabel> : label}
        className="w-full"
      >
        <div className="relative w-full">
          <textarea
            className="fluent w-full min-w-[360px]"
            style={{ minHeight: 180, resize: 'vertical', width: '100%' }}
            onChange={onChange}
            value={value}
          />
        </div>
        {isSystemMessage && (
          <div className="flex justify-end mt-2 mb-3">
            <Button
              icon={enhancingPrompt ? <Spinner size="tiny" /> : <SparkleRegular />}
              appearance="primary"
              disabled={enhancingPrompt || !value || typeof value !== 'string' || value.trim() === ''}
              onClick={handleEnhanceSystemPrompt}
              className="px-3 py-2 transform hover:scale-105 transition-transform duration-200"
              size="medium"
              iconPosition="before"
            >
              {t('Common.EnhanceInstructions')}
            </Button>
          </div>
        )}
        <div>
          <Text size={200} className="text-color-secondary">
            {t('Prompt.Form.Tooltip.Variable')}
          </Text>
          <Text size={200} className="text-color-secondary mt-1 block">
            {isSystemMessage 
              ? t('Prompt.Form.Example.SystemVariable')
              : t('Prompt.Form.Example.UserVariable')}
          </Text>
          {isSystemMessage && (
            <Text size={200} className="text-color-secondary mt-1 block">
              <span className="text-blue-500">✨ Tip:</span> Click the sparkle icon to enhance your system prompt using AI-powered prompt engineering techniques.
            </Text>
          )}
        </div>
      </Field>
      {variables.length ? (
        <Divider className="mt-2.5 mb-1.5">
          {label}
          {t('Common.Variables')}
          &nbsp;({variables.length})
        </Divider>
      ) : null}
      <div className="flex justify-start items-center gap-2 flex-wrap">
        {variables.map((variable: string) => (
          <div
            key={variable}
            className="tag-variable px-2.5 py-1.5 flex items-center justify-start"
          >
            <BracesVariable20Regular />
            &nbsp;{variable}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Form() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState<string>('');
  const [models, setModels] = useState<string[]>([]);
  const [systemMessage, setSystemMessage] = useState<string>('');
  const [userMessage, setUserMessage] = useState<string>('');
  const [systemVariables, setSystemVariables] = useState<string[]>([]);
  const [userVariables, setUserVariables] = useState<string[]>([]);
  const createPrompt = usePromptStore((state) => state.createPrompt);
  const updatePrompt = usePromptStore((state) => state.updatePrompt);
  const getPrompt = usePromptStore((state) => state.getPrompt);
  const { notifyInfo, notifySuccess, notifyError } = useToast();
  const [skipParsing, setSkipParsing] = useState<boolean>(false);
  const [enhancingPrompt, setEnhancingPrompt] = useState<boolean>(false);

  type PromptPayload = { id: string } & Partial<IPromptDef>;

  useEffect(() => {
    if (id) {
      getPrompt(id)
        .then(($prompt) => {
          setName($prompt.name);
          setModels($prompt.models || []);
          setSystemMessage($prompt.systemMessage);
          setUserMessage($prompt.userMessage);
          return $prompt;
        })
        .catch(() => {
          notifyError(t('Prompt.Notifications.PromptNotFound'));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setSystemVariables(parseVariables(systemMessage));
  }, [systemMessage]);

  useEffect(() => {
    setUserVariables(parseVariables(userMessage));
  }, [userMessage]);

  const onSystemMessageChange = (e: any) => {
    setSystemMessage(e.target.value);
  };
  const onUserMessageChange = (e: any) => {
    setUserMessage(e.target.value);
  };

  const onSave = async () => {
    const $prompt = {
      id,
      name,
      userMessage,
      userVariables,
    } as PromptPayload;
    
    // Keep the models array if it exists from an existing prompt
    if (models.length > 0) {
      $prompt.models = models;
    }
    
    // Handle system message (no longer checking for claude models since we don't have the selector)
    $prompt.systemMessage = systemMessage;
    $prompt.systemVariables = systemVariables;
    
    if (isBlank($prompt.name)) {
      notifyInfo(t('Notification.NameRequired'));
      return;
    }
    if (isBlank($prompt.userMessage) && isBlank($prompt.systemMessage)) {
      notifyInfo(
        t('Prompt.Notifications.MessageRequired')
      );
      return;
    }
    if ($prompt.id) {
      await updatePrompt($prompt);
      notifySuccess(t('Prompt.Notifications.PromptUpdated'));
    } else {
      await createPrompt($prompt);
      notifySuccess(t('Prompt.Notifications.PromptCreated'));
    }

    navigate(-1);
  };

  const handleEnhanceSystemPrompt = async () => {
    try {
      if (!systemMessage || systemMessage.trim() === '') {
        notifyError(t('Common.EnhanceSystemMessageError'));
        return;
      }

      setEnhancingPrompt(true);

      const enhancedSystemPrompt = await enhanceSystemPrompt(systemMessage);
      
      setSystemMessage(enhancedSystemPrompt);
      notifySuccess(t('Common.SystemMessageEnhanced'));
    } catch (error) {
      console.error('Error enhancing system message:', error);
      notifyError(t('Common.EnhanceSystemMessageError'));
    } finally {
      setEnhancingPrompt(false);
    }
  };

  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t('Common.Prompts')}</h1>
          <div className="flex items-center justify-end gap-2">
            <Button appearance="subtle" onClick={() => navigate(-1)}>
              {t('Common.Cancel')}
            </Button>
            <Button appearance="primary" onClick={onSave}>
              {t('Common.Save')}
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full overflow-y-auto">
        <div className="flex flex-col w-[80%] mx-auto">
          <div className="w-full">
            <div className="mb-2.5">
              <Field label={t('Common.Name')}>
                <Input
                  value={name}
                  placeholder={t('Common.Required')}
                  defaultValue={prompt.name || ''}
                  onChange={(
                    ev: ChangeEvent<HTMLInputElement>,
                    data: InputOnChangeData
                  ) => setName(data.value || '')}
                  className="w-full"
                />
              </Field>
            </div>
            <div className="space-y-4 mb-4 w-full">
              <div className="relative w-full">
                <MessageField
                  label={t('Common.Instructions')}
                  tooltip={t('Tooltip.Instructions')}
                  value={systemMessage}
                  onChange={onSystemMessageChange}
                  variables={systemVariables}
                />
              </div>
              <div className="relative w-full">
                <MessageField
                  label={t('Common.FirstMessageTemplate')}
                  value={userMessage}
                  onChange={onUserMessageChange}
                  variables={userVariables}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="h-16" />
      </div>
    </div>
  );
}
