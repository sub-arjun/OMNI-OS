/* eslint-disable react/no-danger */
import {
  Dialog,
  DialogTrigger,
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  Input,
  DialogActions,
  Tooltip,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  Dismiss24Regular,
  Prompt20Regular,
  Prompt20Filled,
  Search20Regular,
  ChevronDown16Regular,
  ArrowSyncCircleRegular,
} from '@fluentui/react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import usePromptStore from 'stores/usePromptStore';
import { fillVariables, highlight, insertAtCursor, parseVariables } from 'utils/util';
import { isNil, pick } from 'lodash';
import PromptVariableDialog from '../PromptVariableDialog';
import { IChat, IChatContext, IPrompt } from 'intellichat/types';
import useChatStore from 'stores/useChatStore';
import ClickAwayListener from 'renderer/components/ClickAwayListener';
import useAppearanceStore from 'stores/useAppearanceStore';

const PromptIcon = bundleIcon(Prompt20Filled, Prompt20Regular);

export default function PromptCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(false);
  const [keyword, setKeyword] = useState<string>('');
  const [variableDialogOpen, setVariableDialogOpen] = useState<boolean>(false);
  const [systemVariables, setSystemVariables] = useState<string[]>([]);
  const [userVariables, setUserVariables] = useState<string[]>([]);
  const [promptPickerOpen, setPromptPickerOpen] = useState<boolean>(false);
  const [pickedPrompt, setPickedPrompt] = useState<IPrompt | null>(null);
  const allPrompts = usePromptStore((state) => state.prompts);
  const fetchPrompts = usePromptStore((state) => state.fetchPrompts);
  const getPrompt = usePromptStore((state) => state.getPrompt);
  const editStage = useChatStore((state) => state.editStage);
  const theme = useAppearanceStore((state) => state.theme);
  const appTheme = theme === 'system' ? 'light' : theme as 'light' | 'dark';

  const openDialog = () => {
    fetchPrompts({});
    setOpen(true);
    setTimeout(
      () => document.querySelector<HTMLInputElement>('#prompt-search')?.focus(),
      500,
    );
    Mousetrap.bind('esc', closeDialog);
  };

  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind('esc');
  };

  // Handle click away from dialog
  const handleClickAway = () => {
    if (open) {
      closeDialog();
    }
  };

  const prompts = useMemo(() => {
    return allPrompts.filter((prompt) => {
      if (keyword && keyword.trim() !== '') {
        return (
          prompt.name.toLowerCase().indexOf(keyword.trim().toLowerCase()) >= 0
        );
      }
      return true;
    });
  }, [allPrompts, keyword]);

  const insertUserMessage = (msg: string): string => {
    const editor = document.querySelector('#editor') as HTMLDivElement;
    // Clear the editor first
    editor.innerHTML = '';
    return insertAtCursor(editor, msg);
  };

  const applyPrompt = async (promptId: string) => {
    const prompt = await getPrompt(promptId);
    if (prompt) {
      const $prompt = pick(prompt, [
        'id',
        'name',
        'systemMessage',
        'userMessage',
        'temperature',
        'maxTokens',
        'systemVariables',
        'userVariables',
      ]);
      setOpen(false);
      setSystemVariables(prompt.systemVariables || []);
      setUserVariables(prompt.userVariables || []);
      if (
        (prompt.systemVariables?.length || 0) > 0 ||
        (prompt.userVariables?.length || 0) > 0
      ) {
        setPickedPrompt($prompt);
        setVariableDialogOpen(true);
      } else {
        const input = insertUserMessage(prompt.userMessage);
        editStage(chat.id, { prompt: $prompt, input });
      }
    }
    const editor = document.querySelector('#editor') as HTMLTextAreaElement;
    editor.focus();
    window.electron.ingestEvent([{ app: 'apply-prompt' }]);
  };

  const removePrompt = () => {
    setOpen(false);
    setTimeout(() => editStage(chat.id, { prompt: null }), 300);
  };

  const redoPrompt = () => {
    if (chat.prompt) {
      // Clear the editor first before any processing
      const editor = document.querySelector('#editor') as HTMLDivElement;
      if (editor) {
        editor.innerHTML = '';
      }
      
      const promptData = chat.prompt as IPrompt;
      
      // Check if we have original messages with variables
      const hasOriginalSystem = !!promptData.originalSystemMessage;
      const hasOriginalUser = !!promptData.originalUserMessage;
      
      // Use the original system message and user message if they exist
      const systemMessage = promptData.originalSystemMessage || promptData.systemMessage;
      const userMessage = promptData.originalUserMessage || promptData.userMessage;
      
      // Extract variables from the original messages
      const systemVars = systemMessage ? parseVariables(systemMessage) : [];
      const userVars = userMessage ? parseVariables(userMessage) : [];
      
      // Check if we have variables that need to be filled
      const hasSystemVars = systemVars.length > 0;
      const hasUserVars = userVars.length > 0;
      
      if (hasSystemVars || hasUserVars) {
        // Create a new prompt object with original templates
        const newPrompt = {
          ...promptData,
          systemMessage: systemMessage,
          userMessage: userMessage
        };
        
        // Set variables and open dialog
        setSystemVariables(systemVars);
        setUserVariables(userVars);
        setPickedPrompt(newPrompt);
        setVariableDialogOpen(true);
      } else if (userMessage) {
        // If there are no variables, insert fresh user message into cleared editor
        const input = insertUserMessage(userMessage);
        editStage(chat.id, { input });
      }
      setOpen(false);
    }
  };

  const onVariablesCancel = useCallback(() => {
    setPickedPrompt(null);
    setVariableDialogOpen(false);
  }, [setPickedPrompt]);

  const onVariablesConfirm = useCallback(
    (
      systemVars: { [key: string]: string },
      userVars: { [key: string]: string },
    ) => {
      const payload: any = {
        prompt: { ...pickedPrompt },
      };
      
      // Save the original template messages with variables
      if (!payload.prompt.originalSystemMessage && pickedPrompt?.systemMessage) {
        payload.prompt.originalSystemMessage = pickedPrompt.systemMessage;
      }
      if (!payload.prompt.originalUserMessage && pickedPrompt?.userMessage) {
        payload.prompt.originalUserMessage = pickedPrompt.userMessage;
      }
      
      if (pickedPrompt?.systemMessage) {
        // Fill the variables in the system message
        payload.prompt.systemMessage = fillVariables(
          payload.prompt.originalSystemMessage || pickedPrompt.systemMessage,
          systemVars,
        );
        
        // Store the filled variables for future use
        payload.prompt.filledSystemVars = systemVars;
      }
      
      if (pickedPrompt?.userMessage) {
        // Fill the variables in the user message
        payload.prompt.userMessage = fillVariables(
          payload.prompt.originalUserMessage || pickedPrompt.userMessage,
          userVars,
        );
        
        // Store the filled variables for future use
        payload.prompt.filledUserVars = userVars;
        
        // Clear editor and insert the filled user message
        payload.input = insertUserMessage(payload.prompt.userMessage);
      }
      
      editStage(chat.id, payload);
      setVariableDialogOpen(false);
    },
    [pickedPrompt, editStage, chat.id],
  );

  useEffect(() => {
    Mousetrap.bind('ctrl+shift+p', openDialog);
    return () => {
      Mousetrap.unbind('ctrl+shift+p');
    };
  }, [open]);

  // Check if there's a prompt applied and it has variables
  const hasPromptVariables = chat.prompt && (
    ((chat.prompt as IPrompt).systemVariables?.length ?? 0) > 0 || 
    ((chat.prompt as IPrompt).userVariables?.length ?? 0) > 0
  );

  return (
    <>
      <div className="flex items-center prompt-control-wrapper">
        <div className="flex prompt-button-container rounded-md overflow-hidden">
          <ClickAwayListener onClickAway={handleClickAway} active={open}>
            <Dialog open={open} onOpenChange={() => setPromptPickerOpen(false)}>
              <DialogTrigger disableButtonEnhancement>
                <Tooltip
                  content={
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Prompts')}</div>
                      <div>Apply reusable templates and conversation starters (Ctrl+Shift+P)</div>
                      {(chat.prompt as IPrompt)?.name && (
                        <div style={{ marginTop: '3px', fontSize: '12px' }}>
                          Active: {(chat.prompt as IPrompt)?.name}
                        </div>
                      )}
                      {hasPromptVariables && (
                        <div style={{ marginTop: '3px', fontSize: '12px', fontStyle: 'italic' }}>
                          Contains variables that can be redefined
                        </div>
                      )}
                    </div>
                  }
                  relationship="description"
                  positioning="above"
                >
                  <Button
                    size="small"
                    aria-label={t('Common.Prompts')}
                    appearance="subtle"
                    style={{ borderColor: 'transparent', boxShadow: 'none', height: '100%' }}
                    className="flex justify-start items-center text-color-secondary gap-1 prompt-button-main"
                    onClick={openDialog}
                    icon={<PromptIcon className="flex-shrink-0" />}
                  >
                    {(chat.prompt as IPrompt)?.name && (
                      <span
                        className={`flex-shrink overflow-hidden whitespace-nowrap text-ellipsis ${
                          (chat.prompt as IPrompt)?.name ? 'min-w-8' : 'w-0'
                        } `}
                      >
                        {(chat.prompt as IPrompt)?.name}
                      </span>
                    )}
                  </Button>
                </Tooltip>
              </DialogTrigger>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle
                    action={
                      <DialogTrigger action="close">
                        <Button
                          appearance="subtle"
                          aria-label="close"
                          onClick={closeDialog}
                          icon={<Dismiss24Regular />}
                        />
                      </DialogTrigger>
                    }
                  >
                    {t('Common.Prompt')}
                  </DialogTitle>
                  <DialogContent>
                    {isNil(chat.prompt) || promptPickerOpen ? (
                      <div>
                        <div className="mb-2.5">
                          <Input
                            id="prompt-search"
                            contentBefore={<Search20Regular />}
                            placeholder={t('Common.Search')}
                            className="w-full"
                            value={keyword}
                            onChange={(e, data) => {
                              setKeyword(data.value);
                            }}
                          />
                        </div>
                        <div>
                          {prompts.map((prompt: IPrompt) => {
                            return (
                              <Button
                                className="w-full justify-start my-1.5"
                                appearance="subtle"
                                key={prompt.id}
                                onClick={() => applyPrompt(prompt.id)}
                              >
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: highlight(prompt.name, keyword),
                                  }}
                                />
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="pb-4">
                        <div className="text-lg font-medium">
                          {(chat.prompt as IPrompt)?.name || ''}
                        </div>
                        {(chat.prompt as IPrompt)?.systemMessage ? (
                          <div>
                            <div>
                              <span className="mr-1">
                                {t('Common.SystemMessage')}:{' '}
                              </span>
                              <span
                                className="leading-6"
                                dangerouslySetInnerHTML={{
                                  __html: (chat.prompt as IPrompt).systemMessage,
                                }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </DialogContent>
                  {isNil(chat.prompt) || promptPickerOpen ? null : (
                    <DialogActions>
                      <DialogTrigger disableButtonEnhancement>
                        <Button appearance="secondary" onClick={removePrompt}>
                          {t('Common.Delete')}
                        </Button>
                      </DialogTrigger>
                      <Button
                        appearance="primary"
                        onClick={() => setPromptPickerOpen(true)}
                      >
                        {t('Common.Change')}
                      </Button>
                    </DialogActions>
                  )}
                </DialogBody>
              </DialogSurface>
            </Dialog>
          </ClickAwayListener>
          
          {/* Redo button with chevron */}
          {chat.prompt && (
            <Tooltip 
              content={t('Common.Redo')} 
              relationship="label"
            >
              <button
                type="button"
                className={`flex items-center justify-center prompt-button-chevron ${
                  appTheme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
                } focus:outline-none transition-all duration-200
                hover:bg-gray-200 dark:hover:bg-gray-700`}
                onClick={redoPrompt}
                title={t('Common.Redo')}
              >
                <ArrowSyncCircleRegular className="w-5 h-5" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      
      <PromptVariableDialog
        open={variableDialogOpen}
        systemVariables={systemVariables}
        userVariables={userVariables}
        onCancel={onVariablesCancel}
        onConfirm={onVariablesConfirm}
      />
      
      {/* Add styles similar to SpeechCtrl */}
      <style>
        {`
          .prompt-control-wrapper {
            height: 30px;
          }
          
          .prompt-button-container {
            display: flex;
            border-radius: 6px;
            overflow: hidden;
            height: 100%;
          }
          
          .prompt-button-main {
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            height: 100%;
            display: flex;
            align-items: center;
          }
          
          .prompt-button-chevron {
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            border-top-right-radius: 6px;
            border-bottom-right-radius: 6px;
            height: 100%;
            padding: 0 5px;
            display: flex;
            align-items: center;
            min-width: 10px;
            width: 30px;
          }
        `}
      </style>
    </>
  );
}
