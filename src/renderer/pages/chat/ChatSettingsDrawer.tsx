import {
  Field,
  Button,
  Input,
  Textarea,
  Divider,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Spinner,
  Tooltip,
  Label,
} from '@fluentui/react-components';
import { Search24Regular, Dismiss24Regular, SparkleRegular } from '@fluentui/react-icons';
import Debug from 'debug';
import {
  useState,
  ChangeEvent,
  KeyboardEvent,
  useMemo,
  useEffect,
} from 'react';
import useChatStore from 'stores/useChatStore';
import { useTranslation } from 'react-i18next';
import useChatContext from 'hooks/useChatContext';
import { debounce } from 'lodash';
import { enhanceSystemPrompt } from 'utils/util';
import useToast from 'hooks/useToast';

const debug = Debug('OMNI-OS:pages:chat:ChatSettingsDrawer');

export default function ChatSettingsDrawer({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const activeChat = useChatContext().getActiveChat();
  const { notifySuccess, notifyError } = useToast();
  
  useEffect(() => {
    setSystemMessage(activeChat.systemMessage || '');
  }, [activeChat?.id]);

  const setKeyword = useChatStore((state) => state.setKeyword);
  const keywords = useChatStore((state) => state.keywords);

  const keyword = useMemo(
    () => keywords[activeChat?.id] || '',
    [keywords, activeChat?.id],
  );

  const [systemMessage, setSystemMessage] = useState<string>('');
  const [enhancingPrompt, setEnhancingPrompt] = useState<boolean>(false);

  const editStage = useChatStore((state) => state.editStage);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      setOpen(false);
    }
  };

  const onSystemMessageChange = (ev: ChangeEvent<HTMLTextAreaElement>) => {
    setSystemMessage(ev.target.value);
    updateSystemMessage(ev);
  };

  const updateSystemMessage = useMemo(
    () =>
      debounce((ev: ChangeEvent<HTMLTextAreaElement>) => {
        const systemMessage = ev.target.value;
        editStage(activeChat.id, { systemMessage });
      }, 1000),
    [activeChat?.id],
  );

  const handleEnhanceSystemPrompt = async () => {
    try {
      if (!systemMessage || systemMessage.trim() === '') {
        notifyError(t('Common.EnhanceSystemMessageError'));
        return;
      }

      setEnhancingPrompt(true);

      const enhancedSystemPrompt = await enhanceSystemPrompt(systemMessage);
      
      setSystemMessage(enhancedSystemPrompt);
      editStage(activeChat.id, { systemMessage: enhancedSystemPrompt });
      notifySuccess(t('Common.SystemMessageEnhanced'));
    } catch (error) {
      console.error('Error enhancing system message:', error);
      notifyError(t('Common.EnhanceSystemMessageError'));
    } finally {
      setEnhancingPrompt(false);
    }
  };

  return (
    <div>
      <Drawer
        position="end"
        open={open}
        onOpenChange={(_, { open }) => setOpen(open)}
        className="chat-settings-drawer"
        style={{ minWidth: '450px', width: '35vw', maxWidth: '600px' }}
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                aria-label="Close"
                icon={<Dismiss24Regular />}
                onClick={() => setOpen(false)}
              />
            }
          >
            &nbsp;
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody className="mt-2.5 flex flex-col gap-2 relative">
          {activeChat.isPersisted ? (
            <div className="mb-2.5">
              <Input
                id="inchat-search"
                contentBefore={<Search24Regular />}
                placeholder={t('Chat.InConversationSearch')}
                className="w-full"
                value={keyword}
                onKeyDown={onSearchKeyDown}
                onChange={(e, data) => {
                  setKeyword(activeChat?.id, data.value);
                }}
              />
            </div>
          ) : null}
          <div className="mb-1.5">
            <Divider>{t('Common.Settings')}</Divider>
          </div>
          <div className="mb-4 relative">
            <Field label={t('Common.SystemMessage')} className="w-full">
              <div className="relative w-full">
                <Textarea
                  rows={40}
                  value={systemMessage}
                  onChange={onSystemMessageChange}
                  resize="vertical"
                  className="w-full min-w-[360px]"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="flex justify-between items-center">
                <Label htmlFor="system-message" size="large">
                  {t('ChatSettings.SystemMessage')}
                </Label>
                <Button
                  icon={enhancingPrompt ? <Spinner size="tiny" /> : <SparkleRegular />}
                  appearance="subtle"
                  disabled={!systemMessage || enhancingPrompt}
                  onClick={handleEnhanceSystemPrompt}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
                  size="small"
                >
                  {t('Common.EnhanceSystemPrompt')}
                </Button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                <p><strong>Tip:</strong> System messages give instructions to the AI about how to behave.</p>
                <p className="mt-1">For beginners: Use this to set the AI's role (e.g., "You are a helpful math tutor") or give specific instructions.</p>
                <p className="mt-1">For advanced users: Define constraints, formatting requirements, or custom behaviors to control the model's responses.</p>
                <p className="mt-1">Click the ✨ icon to enhance your system prompt using AI-powered prompt engineering techniques.</p>
              </div>
            </Field>
          </div>
          <div className="flex-grow" />
        </DrawerBody>
      </Drawer>
    </div>
  );
}
