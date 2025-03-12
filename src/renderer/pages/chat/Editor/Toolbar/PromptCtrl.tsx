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
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  Dismiss24Regular,
  Prompt20Regular,
  Prompt20Filled,
  Search20Regular,
} from '@fluentui/react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import usePromptStore from 'stores/usePromptStore';
import { fillVariables, highlight, insertAtCursor } from 'utils/util';
import { isNil, pick } from 'lodash';
import PromptVariableDialog from '../PromptVariableDialog';
import { IChat, IChatContext, IPrompt } from 'intellichat/types';
import useChatStore from 'stores/useChatStore';
import ClickAwayListener from 'renderer/components/ClickAwayListener';

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
      if (pickedPrompt?.systemMessage) {
        payload.prompt.systemMessage = fillVariables(
          pickedPrompt.systemMessage,
          systemVars,
        );
      }
      if (pickedPrompt?.userMessage) {
        payload.prompt.userMessage = fillVariables(
          pickedPrompt.userMessage,
          userVars,
        );
        payload.input = insertUserMessage(payload.prompt.userMessage);
      }
      editStage(chat.id, payload);
      setVariableDialogOpen(false);
    },
    [pickedPrompt, editStage, chat.id],
  );

  useEffect(() => {
    Mousetrap.bind('mod+shift+2', openDialog);
    return () => {
      Mousetrap.unbind('mod+shift+2');
    };
  }, [open]);

  return (
    <>
      <ClickAwayListener onClickAway={handleClickAway} active={open}>
        <Dialog open={open} onOpenChange={() => setPromptPickerOpen(false)}>
          <DialogTrigger disableButtonEnhancement>
            <Button
              size="small"
              title="Mod+Shift+2"
              aria-label={t('Common.Prompts')}
              appearance="subtle"
              style={{ borderColor: 'transparent', boxShadow: 'none' }}
              className="flex justify-start items-center text-color-secondary gap-1"
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
      <PromptVariableDialog
        open={variableDialogOpen}
        systemVariables={systemVariables}
        userVariables={userVariables}
        onCancel={onVariablesCancel}
        onConfirm={onVariablesConfirm}
      />
    </>
  );
}
