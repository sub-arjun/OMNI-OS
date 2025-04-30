import {
  Button,
  Text,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tooltip,
} from '@fluentui/react-components';
import {
  bundleIcon,
  Delete16Filled,
  Delete16Regular,
  Bookmark16Filled,
  Bookmark16Regular,
  Copy16Regular,
  Copy16Filled,
  CheckmarkCircle16Regular,
  CheckmarkCircle16Filled,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useBookmarkStore from 'stores/useBookmarkStore';
import useChatStore from 'stores/useChatStore';
import useSettingsStore from 'stores/useSettingsStore';
import useProvider from 'hooks/useProvider';
import { IBookmark } from 'types/bookmark';
import { fmtDateTime, unix2date } from 'utils/util';
import useToast from 'hooks/useToast';
import { IChatMessage } from 'intellichat/types';
import TTSButton from 'renderer/components/TTSButton';
import ClickAwayListener from 'renderer/components/ClickAwayListener';

const DeleteIcon = bundleIcon(Delete16Filled, Delete16Regular);
const CopyIcon = bundleIcon(Copy16Filled, Copy16Regular);
const BookmarkAddIcon = bundleIcon(Bookmark16Filled, Bookmark16Regular);
const BookmarkOffIcon = bundleIcon(Bookmark16Regular, Bookmark16Filled);
const CheckIcon = bundleIcon(CheckmarkCircle16Filled, CheckmarkCircle16Regular);

export default function MessageToolbar({ message }: { message: IChatMessage }) {
  const { t } = useTranslation();
  const [delPopoverOpen, setDelPopoverOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  // Feedback state to show bookmarked icon temporarily
  const [bookmarkFeedback, setBookmarkFeedback] = useState(false);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const bookmarkMessage = useChatStore((state) => state.bookmarkMessage);
  const createBookmark = useBookmarkStore((state) => state.createBookmark);
  const deleteBookmark = useBookmarkStore((state) => state.deleteBookmark);
  const { notifySuccess } = useToast();
  
  // Get current provider to check if we're using OMNI Edge
  const { api } = useSettingsStore.getState();
  const { getProvider } = useProvider();
  const currentProvider = getProvider(api.provider);
  const isOllamaProvider = currentProvider.name === 'Ollama';
  
  const bookmark = async () => {
    const bookmark = await createBookmark({
      msgId: message.id,
      prompt: message.prompt,
      reply: message.reply,
      reasoning: message.reasoning||'',
      model: message.model,
      temperature: message.temperature,
      citedFiles: message.citedFiles,
      citedChunks: message.citedChunks,
      memo: message.memo,
    } as IBookmark);
    await bookmarkMessage(message.id, bookmark.id);
    notifySuccess(t('Common.Notification.BookmarkAdded'));
  };

  const unbookmark = async () => {
    if (!message.bookmarkId) return;
    await deleteBookmark(message.bookmarkId);
    await bookmarkMessage(message.id, null);
    notifySuccess(t('Common.Notification.BookmarkRemoved'));
  };

  const copy = () => {
    // Just copy the assistant's reply without prefixes
    let content = `${message.reply}`;
    
    // Add citations if they exist
    try {
      let citations = [];
      if (message.citations) {
        if (Array.isArray(message.citations)) {
          citations = message.citations;
        } else {
          citations = JSON.parse(message.citations);
        }
      }
      
      // Add references section if citations exist
      if (citations && citations.length > 0) {
        content += '\n\n' + t('Common.Citations') + ':\n';
        citations.forEach((citation: string, index: number) => {
          content += `[${index + 1}] ${citation}\n`;
        });
      }
      
      // Add cited files if they exist
      if (message.citedFiles) {
        const files = JSON.parse(message.citedFiles || '[]');
        if (files.length > 0) {
          content += '\n\n' + t('Common.References') + ':\n';
          files.forEach((file: string, index: number) => {
            content += `[${index + 1}] ${file}\n`;
          });
        }
      }
    } catch (e) {
      console.error('Error formatting citations for copy:', e);
    }
    
    // Always use the fallback method for clipboard copying
    const textarea = document.createElement('textarea');
    textarea.value = content;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    notifySuccess(t('Common.Notification.Copied'));
  };

  const handleCopyClick = () => {
    copy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle bookmark click with temporary feedback
  const handleBookmarkClick = () => {
    bookmark();
    setBookmarkFeedback(true);
    setTimeout(() => setBookmarkFeedback(false), 2000);
  };

  // Handle click away from delete popover
  const handleClickAway = () => {
    if (delPopoverOpen) {
      setDelPopoverOpen(false);
    }
  };

  // Determine if message is from the assistant
  const isAssistantMessage = message.reply && !message.isActive;

  return !message.isActive && (
    <div className="message-toolbar p-0.5 rounded-md flex justify-between items-center mb-5">
      <div className="flex justify-start items-center gap-3">
        {/* Only show TTS button for assistant messages and when not using Ollama/OMNI Edge */}
        {isAssistantMessage && !isOllamaProvider && (
          <TTSButton 
            message={message.reply} 
            id={`tts-${message.id}`} 
          />
        )}
        
        {bookmarkFeedback ? (
          <Tooltip
            content={t('Common.Notification.BookmarkAdded')}
            relationship="label"
          >
            <Button
              size="small"
              icon={<Bookmark16Filled className="text-amber-500" />}
              appearance="subtle"
            />
          </Tooltip>
        ) : message.bookmarkId ? (
          <Tooltip
            content={t('Common.Action.Bookmark')}
            relationship="label"
          >
            <Button
              size="small"
              icon={<BookmarkOffIcon />}
              appearance="subtle"
              onClick={unbookmark}
            />
          </Tooltip>
        ) : (
          <Tooltip
            content={t('Common.Action.Bookmark')}
            relationship="label"
          >
            <Button
              size="small"
              icon={<BookmarkAddIcon />}
              appearance="subtle"
              onClick={handleBookmarkClick}
            />
          </Tooltip>
        )}
        <Button
          size="small"
          icon={copied ? <CheckIcon className="text-green-500" /> : <CopyIcon />}
          appearance="subtle"
          onClick={handleCopyClick}
        />
        <ClickAwayListener onClickAway={handleClickAway} active={delPopoverOpen}>
          <Popover withArrow open={delPopoverOpen}>
            <PopoverTrigger disableButtonEnhancement>
              <Button
                size="small"
                icon={<DeleteIcon />}
                appearance="subtle"
                onClick={() => setDelPopoverOpen(true)}
              />
            </PopoverTrigger>
            <PopoverSurface>
              <div>
                <div className="p-2 mb-2 text-center">
                  {t('Common.DeleteConfirmation')}
                </div>
                <div className="flex justify-evenly gap-5 items-center">
                  <Button
                    size="small"
                    appearance="subtle"
                    onClick={() => setDelPopoverOpen(false)}
                  >
                    {t('Common.Cancel')}
                  </Button>
                  <Button
                    size="small"
                    appearance="primary"
                    onClick={() => {
                      deleteMessage(message.id);
                      setDelPopoverOpen(false);
                      notifySuccess(t('Message.Notification.Deleted'));
                    }}
                  >
                    {t('Common.Yes')}
                  </Button>
                </div>
              </div>
            </PopoverSurface>
          </Popover>
        </ClickAwayListener>
      </div>
      <div className="mr-2.5">
        <div className="flex justify-start items-center gap-5">
          <Text size={200}>
            <span className="latin hidden sm:block">
              {(message.inputTokens || 0) + (message.outputTokens || 0)} tokens
            </span>
          </Text>
          <Text size={200}>
            <span className="latin">{message.model}</span>
          </Text>
          <Text size={200} truncate>
            <span className="latin">
              {fmtDateTime(unix2date(message.createdAt))}
            </span>
          </Text>
        </div>
      </div>
    </div>
  );
}
