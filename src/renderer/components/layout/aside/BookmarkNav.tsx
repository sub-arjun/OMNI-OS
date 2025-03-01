import { Button, Tooltip } from '@fluentui/react-components';
import { Bookmark20Filled, Bookmark20Regular } from '@fluentui/react-icons';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useNav from 'hooks/useNav';
import useBookmarkStore from 'stores/useBookmarkStore';
import { IBookmark } from 'types/bookmark';

export default function BookmarkNav({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const activeBookmarkId = useBookmarkStore((state) => state.activeBookmarkId);
  const favorites = useBookmarkStore((state) => state.favorites);
  const loadFavorites = useBookmarkStore((state) => state.loadFavorites);
  const navigate = useNav();

  useEffect(() => {
    loadFavorites({ limit: 100, offset: 0 });
  }, [loadFavorites]);

  const renderIconWithTooltip = (
    isActiveBookmark: boolean,
    summary: string
  ) => {
    return (
      <Tooltip
        withArrow
        content={summary?.substring(0, 200)}
        relationship="label"
        positioning="above-start"
      >
        {isActiveBookmark ? <Bookmark20Filled /> : <Bookmark20Regular />}
      </Tooltip>
    );
  };

  const renderFavorites = () => {
    if (favorites?.length > 0) {
      return favorites.map((bookmark: IBookmark) => {
        return (
          <div
            className={`px-2 ${collapsed ? 'mx-auto' : ''} ${
              !!activeBookmarkId && activeBookmarkId === bookmark.id
                ? 'active'
                : ''
            }`}
            key={bookmark.id}
          >
            <Button
              icon={renderIconWithTooltip(
                !!activeBookmarkId && activeBookmarkId === bookmark.id,
                bookmark.prompt
              )}
              appearance="subtle"
              className="w-full justify-start"
              onClick={() => navigate(`/bookmarks/${bookmark.id}`)}
            >
              {collapsed ? null : (
                <div className="text-sm truncate ...">{bookmark.prompt}</div>
              )}
            </Button>
          </div>
        );
      });
    }
    return (
      <div className="p-4 text-sm text-gray-400">
        {t('Your favorite bookmarkes.')}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div
        className={`flex flex-col pt-2.5 ${collapsed ? 'content-center' : ''}`}
      >
        {renderFavorites()}
      </div>
    </div>
  );
}
