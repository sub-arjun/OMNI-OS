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

  const onSystemMessageChange = (ev: ChangeEvent<HTMLTextAreaElement>) => {
    setSystemMessage(ev.target.value);
    updateSystemMessage(ev);
  };

  const updateSystemMessage = useMemo(
    () =>
      debounce((ev: ChangeEvent<HTMLTextAreaElement>) => {
        editStage(activeChat.id, {
          systemMessage: ev.target.value,
        });
        debug('updated system message', ev.target.value);
      }, 1000),
    [activeChat?.id, editStage],
  );

  const handleEnhancePrompt = async () => {
    setEnhancingPrompt(true);
    try {
      const enhancedPrompt = await enhanceSystemPrompt(systemMessage);
      setSystemMessage(enhancedPrompt);
      updateSystemMessage.flush();
      editStage(activeChat.id, { systemMessage: enhancedPrompt });
      notifySuccess(t('Common.SystemMessageEnhanced'));
    } catch (error) {
      notifyError(t('Common.EnhanceSystemMessageError'));
      console.error('Failed to enhance prompt:', error);
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
          <div className="mb-1.5">
            <Divider>{t('Common.Instructions')}</Divider>
          </div>
          <div className="mb-4 relative">
            <Field label={t('Common.Instructions')} className="w-full">
              <div className="relative w-full">
                <Textarea
                  rows={40}
                  value={systemMessage}
                  onChange={onSystemMessageChange}
                  resize="vertical"
                  className="w-full min-w-[360px]"
                  style={{ width: '100%' }}
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                />
              </div>
              <div className="flex justify-between items-center mt-2 mb-3">
                <Label htmlFor="system-message" size="large">
                  {t('ChatSettings.Instructions')}
                </Label>
                <Button
                  icon={enhancingPrompt ? <Spinner size="tiny" /> : <SparkleRegular />}
                  appearance="primary"
                  disabled={!systemMessage || enhancingPrompt}
                  onClick={handleEnhancePrompt}
                  className="px-3 py-2 transform hover:scale-105 transition-transform duration-200"
                  size="medium"
                  iconPosition="before"
                >
                  {t('Common.EnhanceInstructions')}
                </Button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                <p><strong>Tip:</strong> Instructions give directions to the AI about how to behave.</p>
                <p className="mt-1">For beginners: Use this to set the AI's role (e.g., "You are a helpful math tutor") or give specific instructions.</p>
                <p className="mt-1">For advanced users: Define constraints, formatting requirements, or custom behaviors to control the model's responses.</p>
                <p className="mt-1">Click the ✨ icon to enhance your instructions using AI-powered prompt engineering techniques.</p>
              </div>
            </Field>
          </div>
          <div className="flex-grow" />
        </DrawerBody>
      </Drawer>
    </div>
  );
}
