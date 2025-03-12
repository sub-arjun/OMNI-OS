/* eslint-disable react/no-danger */
import { useTranslation } from 'react-i18next';
import {
  Button,
  Divider,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
} from '@fluentui/react-components';
import {
  ArrowLeft16Filled,
  ArrowLeft16Regular,
  bundleIcon,
  ChevronDown16Regular,
  ChevronUp16Regular,
  Delete16Filled,
  Delete16Regular,
  Edit16Regular,
  Edit16Filled,
  ChatBubblesQuestion16Regular,
  ChatBubblesQuestion16Filled,
  Star16Filled,
  Star16Regular,
} from '@fluentui/react-icons';
import useMarkdown from 'hooks/useMarkdown';
import useToast from 'hooks/useToast';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';
import useBookmarkStore from 'stores/useBookmarkStore';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import CitationDialog from '../chat/CitationDialog';
import useSettingsStore from 'stores/useSettingsStore';
import { IBookmark } from 'types/bookmark';
import { fmtDateTime, unix2date } from 'utils/util';

const ArrowLeftIcon = bundleIcon(ArrowLeft16Filled, ArrowLeft16Regular);
const DeleteIcon = bundleIcon(Delete16Filled, Delete16Regular);
const ChatIcon = bundleIcon(ChatBubblesQuestion16Filled, ChatBubblesQuestion16Regular);
const FavoriteIcon = bundleIcon(Star16Filled, Star16Regular);
const UnfavoriteIcon = bundleIcon(Star16Regular, Star16Filled);

export default function Bookmark() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [delPopoverOpen, setDelPopoverOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const [updated, setUpdated] = useState<boolean>(false);
  const setActiveBookmarkId = useBookmarkStore(
    (state) => state.setActiveBookmarkId,
  );
  const updateBookmarks = useBookmarkStore((state) => state.updateBookmark);
  const deleteBookmark = useBookmarkStore((state) => state.deleteBookmark);
  const loadFavorites = useBookmarkStore((state) => state.loadFavorites);
  const { showCitation } = useKnowledgeStore();
  const { notifyInfo } = useToast();
  const bookmarks = useBookmarkStore((state) => state.bookmarks);
  const { notifySuccess } = useToast();
  const { render } = useMarkdown();
  const fontSize = useSettingsStore((state) => state.fontSize);

  useEffect(() => {
    setUpdated(false);
    setActiveBookmarkId(id as string);
    const links = document.querySelectorAll('.bookmark-reply a');
    links.forEach((link) => {
      link.addEventListener('click', onCitationClick);
    });
    return () => {
      links.forEach((link) => {
        link.removeEventListener('click', onCitationClick);
      });
    };
  }, [updated, id]);

  const bookmark = useMemo(
    () => bookmarks.find((item) => item.id === id) as IBookmark,
    [id],
  );

  const citedFiles = useMemo(
    () => JSON.parse(bookmark?.citedFiles || '[]'),
    [bookmark],
  );

  const [isThinkShow, setIsThinkShow] = useState(false);
  const toggleThink = useCallback(() => {
    setIsThinkShow(!isThinkShow);
  }, [isThinkShow]);

  const onCitationClick = async (event: any) => {
    const url = new URL(event.target?.href);
    if (url.pathname === '/citation' || url.protocol.startsWith('file:')) {
      event.preventDefault();
      const chunkId = url.hash.replace('#', '');
      const chunks = JSON.parse(bookmark.citedChunks || '[]');
      const chunk = chunks.find(
        (chunk: any) => chunk.id === chunkId,
      );
      if (chunk) {
        showCitation(chunk.content);
      } else {
        // Check if this is an OMNIBase citation based on collection ID
        const isOmniBase = chunks.some((i: any) => 
          i.collectionId && i.collectionId.toString().startsWith('omnibase:')
        );
        
        if (isOmniBase) {
          notifyInfo(t('Knowledge.Notification.CitationNotFound'));
        } else {
          notifyInfo("The citation was not found and may have been deleted");
        }
      }
    }
  };

  const onDeleteBookmark = async () => {
    await deleteBookmark(bookmark.id);
    navigate(-1);
    notifySuccess(t('Bookmarks.Notification.Removed'));
  };

  const navigateToOriginalMessage = async () => {
    if (bookmark && bookmark.msgId) {
      try {
        // Get the message to find its chatId
        const result = await window.electron.db.get(
          `SELECT chatId FROM messages WHERE id = ?`,
          [bookmark.msgId]
        );
        
        if (result && typeof result === 'object' && 'chatId' in result) {
          navigate(`/chats/${result.chatId}/${bookmark.msgId}`);
        } else {
          notifyInfo(t('Common.Notification.OriginalMessageNotAvailable'));
        }
      } catch (error) {
        console.error("Error finding original message:", error);
        notifyInfo(t('Common.Notification.OriginalMessageNotAvailable'));
      }
    } else {
      notifyInfo(t('Common.Notification.OriginalMessageNotAvailable'));
    }
  };

  const addToFavorites = async () => {
    await updateBookmarks({ id: bookmark.id, favorite: true });
    setUpdated(true);
    loadFavorites({ limit: 100, offset: 0 });
    notifySuccess(t('Bookmarks.Notification.Added'));
  };

  const removeFromFavorites = async () => {
    await updateBookmarks({ id: bookmark.id, favorite: false });
    setUpdated(true);
    loadFavorites({ limit: 100, offset: 0 });
    notifySuccess(t('Bookmarks.Notification.RemovedFavarites'));
  };

  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
      <div className="page-header">
        <div className="bookmark-topbar p-1 rounded flex justify-between items-center">
          <div className="flex justify-start items-center">
            <Button
              size="small"
              icon={<ArrowLeftIcon />}
              appearance="subtle"
              className="flex-shrink-0 justify-start"
              onClick={() => navigate(-1)}
            >
              {t('Common.Back')}
            </Button>
            {bookmark?.favorite ? (
              <Button
                size="small"
                icon={<UnfavoriteIcon />}
                appearance="subtle"
                onClick={removeFromFavorites}
              >
                {t('Common.Action.RemoveFromFavorites')}
              </Button>
            ) : (
              <Button
                size="small"
                icon={<FavoriteIcon />}
                appearance="subtle"
                onClick={addToFavorites}
              >
                {t('Common.Action.Favor')}
              </Button>
            )}
            {bookmark?.msgId && (
              <Button
                size="small"
                icon={<ChatIcon />}
                appearance="subtle"
                onClick={navigateToOriginalMessage}
              >
                {t('View in Chat')}
              </Button>
            )}
            <Popover withArrow open={delPopoverOpen}>
              <PopoverTrigger disableButtonEnhancement>
                <Button
                  size="small"
                  icon={<DeleteIcon />}
                  appearance="subtle"
                  onClick={() => setDelPopoverOpen(true)}
                >
                  {t('Common.Delete')}
                </Button>
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
                      onClick={async () => {
                        await onDeleteBookmark();
                        setDelPopoverOpen(false);
                      }}
                    >
                      {t('Common.Yes')}
                    </Button>
                  </div>
                </div>
              </PopoverSurface>
            </Popover>
          </div>
          <div className="flex justify-start items-center gap-5 mr-4">
            <Text size={200}>
              <span className="latin">{bookmark.model}</span>
            </Text>
            <Text size={200}>
              <span className="latin">
                {fmtDateTime(unix2date(bookmark.createdAt))}
              </span>
            </Text>
          </div>
        </div>
      </div>
      <div className="h-full overflow-y-auto -mr-5 bookmark">
        <div className="mr-5">
          <div className="mx-auto">
            <div
              className={`bg-brand-surface-2 rounded px-1.5 py-2.5 ${fontSize === 'large' ? 'font-lg' : ''}`}
              dangerouslySetInnerHTML={{
                __html: render(bookmark.prompt || ''),
              }}
            />
            <div className="mt-2.5 -mr-5 bookmark-reply">
              {bookmark.reasoning?.trim() ? (
                <div className="think">
                  <div className="think-header" onClick={toggleThink}>
                    <span className={`font-bold text-gray-400 ${fontSize === 'large' ? 'text-base' : ''}`}>
                      {t('Reasoning.Thought')}
                    </span>
                    <div className="text-gray-400 -mb-0.5">
                      {isThinkShow ? (
                        <ChevronUp16Regular />
                      ) : (
                        <ChevronDown16Regular />
                      )}
                    </div>
                  </div>
                  <div
                    className="think-body"
                    style={{ display: isThinkShow ? 'block' : 'none' }}
                  >
                    <div
                      className={fontSize === 'large' ? 'font-lg' : ''}
                      dangerouslySetInnerHTML={{
                        __html: render(bookmark.reasoning || ''),
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <div
                className={`mr-5 leading-7 ${fontSize === 'large' ? 'font-lg' : ''}`}
                dangerouslySetInnerHTML={{
                  __html: render(bookmark.reply || ''),
                }}
              />
            </div>
          </div>
          {citedFiles.length > 0 && (
            <div className="mt-2">
              <div className="mt-4 mb-4">
                <Divider>{t('Common.References')}</Divider>
              </div>
              <ul>
                {citedFiles.map((file: string) => (
                  <li className="text-gray-500" key={file}>
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="h-16" />
      </div>
      <CitationDialog />
    </div>
  );
}
