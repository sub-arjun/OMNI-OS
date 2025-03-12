/* eslint-disable react/no-danger */
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Input, InputOnChangeData, Button, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent } from '@fluentui/react-components';
import { 
  Search24Regular, 
  ChatBubblesQuestion24Regular,
  Delete16Regular,
  Delete16Filled,
  bundleIcon 
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { debounce } from 'lodash';
import useBookmarkStore from 'stores/useBookmarkStore';
import { IBookmark } from 'types/bookmark';
import useNav from 'hooks/useNav';
import Empty from 'renderer/components/Empty';
import { highlight } from '../../../utils/util';
import useToast from 'hooks/useToast';

import './Bookmark.scss';

const DeleteIcon = bundleIcon(Delete16Filled, Delete16Regular);

export default function Bookmarks() {
  const { t } = useTranslation();
  const navigate = useNav();
  const [keyword, setKeyword] = useState<string>('');
  const bookmarks = useBookmarkStore((state) => state.bookmarks);
  const loadBookmarks = useBookmarkStore((state) => state.loadBookmarks);
  const deleteBookmark = useBookmarkStore((state) => state.deleteBookmark);
  const { notifyInfo, notifySuccess } = useToast();
  const [bookmarkToDelete, setBookmarkToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const onKeywordChange = (
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setKeyword(data.value || '');
  };

  const debouncedLoadBookmarks = useMemo(
    () =>
      debounce(
        async (filter: string) => {
          await loadBookmarks({ limit: 1000, keyword: filter });
        },
        400,
        {
          leading: true,
          maxWait: 2000,
        }
      ),
    [loadBookmarks]
  );

  useEffect(() => {
    debouncedLoadBookmarks(keyword);
  }, [debouncedLoadBookmarks, keyword]);

  const navToDetail = (id: string) => {
    navigate(`/bookmarks/${id}`);
  };

  const navigateToOriginalMessage = async (bookmark: IBookmark) => {
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
          // Fallback to bookmark detail if original message not found
          navToDetail(bookmark.id);
        }
      } catch (error) {
        console.error("Error finding original message:", error);
        notifyInfo(t('Common.Notification.OriginalMessageNotAvailable'));
        // Fallback to bookmark detail if original message not found
        navToDetail(bookmark.id);
      }
    } else {
      notifyInfo(t('Common.Notification.OriginalMessageNotAvailable'));
      // Fallback to bookmark detail if original message not found
      navToDetail(bookmark.id);
    }
  };

  const openDeleteDialog = (e: React.MouseEvent, bookmarkId: string) => {
    e.stopPropagation(); // Prevent navigation
    setBookmarkToDelete(bookmarkId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!bookmarkToDelete) return;
    
    try {
      await deleteBookmark(bookmarkToDelete);
      notifySuccess(t('Bookmarks.Notification.Removed'));
      // Refresh the bookmarks list
      debouncedLoadBookmarks(keyword);
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      notifyInfo(t('Common.Notification.ErrorOccurred'));
    } finally {
      setIsDeleteDialogOpen(false);
      setBookmarkToDelete(null);
    }
  };

  const cancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setBookmarkToDelete(null);
  };

  const bookmarkItem = (bookmark: IBookmark) => {
    return (
      <div
        key={bookmark.id}
        role="presentation"
        className="bookmark-item flex-grow pb-16 bg-brand-surface-2 w-full rounded relative"
        onClick={() => navigateToOriginalMessage(bookmark)}
      >
        {/* Delete button in top-right corner */}
        <Button 
          size="small"
          icon={<DeleteIcon />}
          appearance="subtle"
          className="absolute top-2 right-2 text-gray-500 hover:text-red-500 z-10"
          onClick={(e) => openDeleteDialog(e, bookmark.id)}
          title={t('Common.Delete')}
        />
        
        <div className="px-2.5 pt-2.5 text-ellipsis text-wrap break-all">
          <strong
            dangerouslySetInnerHTML={{
              __html: highlight(bookmark.prompt?.substring(0, 70), keyword),
            }}
          />
        </div>
        <div className="px-2.5 pt-1.5 pb-10 text-ellipsis leading-6">
          <div
            dangerouslySetInnerHTML={{
              __html: highlight(
                bookmark.reply?.substring(0, 140) +
                  (bookmark.reply.length > 140 ? '...' : ''),
                keyword
              ),
            }}
          />
        </div>
        <div className="absolute flex justify-between items-center w-full bottom-0 px-2.5 py-2.5">
          <div className="tag-model px-2 py-0 latin">{bookmark.model}</div>
          {bookmark.msgId && (
            <Button 
              size="small"
              icon={<ChatBubblesQuestion24Regular />}
              appearance="transparent"
              className="text-blue-500 hover:text-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                navigateToOriginalMessage(bookmark);
              }}
            >
              {t('View in Chat')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
      <div className="page-header flex items-center justify-between w-full">
        <h1 className="text-2xl flex-shrink-0 mr-6">{t('Common.Bookmarks')}</h1>
        <Input
          contentBefore={<Search24Regular />}
          placeholder={t('Common.Search')}
          value={keyword}
          onChange={onKeywordChange}
          className="w-72"
        />
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        {bookmarks.length ? (
          <div className="bookmarks gap-5 mr-5 grid md:grid-cols-2 grid-cols-1 mb-10">
            {bookmarks.map((bookmark) => bookmarkItem(bookmark))}
          </div>
        ) : (
          <Empty image="reading" text={t('AI learning alphabet...16/26...')} />
        )}
      </div>
      
      {/* Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t('Common.DeleteConfirmation')}</DialogTitle>
            <DialogContent>
              {t('Are you sure you want to delete this bookmark? This action cannot be undone.')}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={cancelDelete}>
                {t('Common.Cancel')}
              </Button>
              <Button appearance="primary" onClick={confirmDelete}>
                {t('Common.Delete')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
