import {
  Button,
  Tooltip,
  Menu,
  MenuTrigger,
  MenuList,
  MenuItem,
  MenuPopover,
  Input,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  Apps24Regular,
  Apps24Filled,
  ChatAdd24Regular,
  ChatAdd24Filled,
  BookmarkMultiple24Regular,
  BookmarkMultiple24Filled,
  EmojiSparkle24Regular,
  EmojiSparkle24Filled,
  Library24Regular,
  Library24Filled,
  bundleIcon,
  Wand24Filled,
  Wand24Regular,
  ReceiptSparkles24Regular,
  ReceiptSparkles24Filled,
  Megaphone24Regular,
  Megaphone24Filled,
  Add16Regular,
  Folder16Regular,
  FolderAdd16Regular,
  Search24Filled,
  Search24Regular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import useNav from 'hooks/useNav';
import { tempChatId } from 'consts';
import WorkspaceMenu from './WorkspaceMenu';
import useMCPStore from 'stores/useMCPStore';
import { useEffect, useMemo, useState } from 'react';
import Spinner from 'renderer/components/Spinner';
import { IMCPServer } from 'types/mcp';
import useChatStore from 'stores/useChatStore';
import { 
  Dialog as FluentDialog, 
  DialogSurface as FluentDialogSurface, 
  DialogTitle as FluentDialogTitle, 
  DialogBody as FluentDialogBody, 
  DialogContent as FluentDialogContent, 
  DialogActions as FluentDialogActions,
  Input as FluentInput,
} from '@fluentui/react-components';
import useAppearanceStore from 'stores/useAppearanceStore';
import SearchDialog from 'renderer/components/SearchDialog';

const AppsIcon = bundleIcon(Apps24Filled, Apps24Regular);
const BookmarkMultipleIcon = bundleIcon(
  BookmarkMultiple24Filled,
  BookmarkMultiple24Regular,
);
const EmojiSparkleIcon = bundleIcon(
  EmojiSparkle24Filled,
  EmojiSparkle24Regular,
);
const ChatAddIcon = bundleIcon(ChatAdd24Filled, ChatAdd24Regular);
const KnowledgeIcon = bundleIcon(Library24Filled, Library24Regular);
const WandIcon = bundleIcon(Wand24Filled, Wand24Regular);
const PromptsIcon = bundleIcon(ReceiptSparkles24Filled, ReceiptSparkles24Regular);
const SearchIcon = bundleIcon(Search24Filled, Search24Regular);

// Export FeedbackIcon for use in AppSidebar
export const FeedbackIcon = bundleIcon(Megaphone24Filled, Megaphone24Regular);

const IS_ASSISTANTS_ENABLED = false;

export default function GlobalNav({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const navigate = useNav();
  const config = useMCPStore((store) => store.config);
  const loadConfig = useMCPStore((state) => state.loadConfig);
  const isMCPServersLoading = useMCPStore((state) => state.isLoading);
  const createFolder = useChatStore((state) => state.createFolder);
  const theme = useAppearanceStore((state) => state?.theme || 'light');
  
  // Folder creation dialog
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);

  const numOfActiveServers = useMemo(
    () => config.servers.filter((server: IMCPServer) => server.isActive).length,
    [config.servers],
  );

  // Create new folder handler
  const handleCreateFolder = async () => {
    if (folderName.trim()) {
      try {
        console.log("Creating folder:", folderName.trim());
        await createFolder(folderName.trim());
        setFolderName('');
        setIsCreateFolderDialogOpen(false);
      } catch (err) {
        console.error("Error creating folder:", err);
      }
    }
  };

  useEffect(() => {
    Mousetrap.bind('ctrl+1', () => navigate('/tool'));
    Mousetrap.bind('ctrl+2', () => navigate('/knowledge'));
    Mousetrap.bind('ctrl+3', () => navigate('/bookmarks'));
    Mousetrap.bind('ctrl+n', () => navigate(`/chats/${tempChatId}`));
    Mousetrap.bind('ctrl+p', () => navigate('/prompts'));
    Mousetrap.bind('alt+f', () => {
      window.electron?.openExternal?.('https://omni-os.canny.io/omni');
      return false;
    });
    Mousetrap.bind('ctrl+alt+s', () => setSearchOpen(true));
    if (numOfActiveServers === 0) {
      loadConfig(true);
    }
    return () => {
      Mousetrap.unbind('ctrl+1');
      Mousetrap.unbind('ctrl+2');
      Mousetrap.unbind('ctrl+3');
      Mousetrap.unbind('ctrl+n');
      Mousetrap.unbind('ctrl+p');
      Mousetrap.unbind('alt+f');
      Mousetrap.unbind('ctrl+alt+s');
    };
  }, []);

  const buttonClasses = collapsed 
    ? "w-full flex justify-center hover:bg-black/10 dark:hover:bg-white/10"
    : "w-full justify-start hover:bg-black/10 dark:hover:bg-white/10";

  return (
    <div
      className={`relative ${
        collapsed ? 'text-center' : ''
      } border-b border-base/40 py-2 flex flex-col`}
    >
      {/* Top Section: Workspace Menu Only */}
      <div className={`flex-shrink-0 flex items-center ${collapsed ? 'justify-center px-1' : 'justify-between px-2'} mb-2`}>
        <div className={collapsed ? '' : 'flex-grow'}> 
          <WorkspaceMenu collapsed={collapsed} />
        </div>
      </div>
      
      {/* Divider after workspace menu */}
      <div className="my-2 border-b border-base/40"></div>

      {/* Bottom Section: Navigation Items */}
      <div className="flex flex-col">
        {IS_ASSISTANTS_ENABLED && (
          <div className={`px-2 my-1 ${collapsed ? 'text-center' : ''}`}>
            <Button
              appearance="subtle"
              icon={<EmojiSparkleIcon />}
              className={buttonClasses}
            >
              {collapsed ? null : t('Common.Assistants')}
            </Button>
          </div>
        )}
        {false && (
          <div className={`px-2 my-1 ${collapsed ? 'text-center' : ''}`}>
            <Button
              appearance="subtle"
              icon={<AppsIcon />}
              className={buttonClasses}
              onClick={() => navigate('/apps')}
            >
              {collapsed ? null : t('Common.Apps')}
            </Button>
          </div>
        )}
        <div className={`px-2 my-1 ${collapsed ? 'text-center' : ''}`}>
          <Tooltip 
            content={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Tools')}</div>
                <div>Manage and activate AI tools (Ctrl+1)</div>
              </div>
            }
            relationship="description"
            positioning="after"
          >
            <Button
              appearance="subtle"
              aria-label={t('Common.Tools')}
              icon={<WandIcon />}
              className={buttonClasses}
              onClick={() => navigate('/tool')}
            >
              {collapsed ? null : (
                <>
                  {t('Common.Tools')}
                  {isMCPServersLoading ? (
                    <Spinner size={13} className="ml-1" />
                  ) : numOfActiveServers ? (
                    `(${numOfActiveServers})`
                  ) : (
                    ''
                  )}
                </>
              )}
            </Button>
          </Tooltip>
        </div>
        <div className={`px-2 my-1 ${collapsed ? 'text-center' : ''}`}>
          <Tooltip
            content={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Knowledge')}</div>
                <div>Manage knowledge bases and collections (Ctrl+2)</div>
              </div>
            }
            relationship="description"
            positioning="after"
          >
            <Button
              appearance="subtle"
              aria-label={t('Common.Knowledge')}
              icon={<KnowledgeIcon />}
              className={buttonClasses}
              onClick={() => navigate('/knowledge')}
            >
              {collapsed ? null : t('Common.Knowledge')}
            </Button>
          </Tooltip>
        </div>
        <div className={`px-2 my-1 ${collapsed ? 'text-center' : ''}`}>
          <Tooltip
            content={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Prompts')}</div>
                <div>Create and manage reusable prompts (Ctrl+P)</div>
              </div>
            }
            relationship="description"
            positioning="after"
          >
            <Button
              appearance="subtle"
              aria-label={t('Common.Prompts')}
              icon={<PromptsIcon />}
              className={buttonClasses}
              onClick={() => navigate('/prompts')}
            >
              {collapsed ? null : t('Common.Prompts')}
            </Button>
          </Tooltip>
        </div>
        <div className={`px-2 my-1 ${collapsed ? 'text-center' : ''}`}>
          <Tooltip
            content={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Bookmarks')}</div>
                <div>View bookmarked messages (Ctrl+3)</div>
              </div>
            }
            relationship="description"
            positioning="after"
          >
            <Button
              appearance="subtle"
              aria-label={t('Common.Bookmarks')}
              icon={<BookmarkMultipleIcon />}
              className={buttonClasses}
              onClick={() => {
                navigate('/bookmarks');
              }}
            >
              {collapsed ? null : t('Common.Bookmarks')}
            </Button>
          </Tooltip>
        </div>
        
        {/* Divider before New/Search/Folder */}
        <div className="my-2 border-b border-base/40"></div>

        {/* New Chat, Search (when expanded), and Folder Buttons */}
        <div className={`flex items-center gap-1 ${collapsed ? 'justify-center flex-col px-1' : 'px-2'}`}>
          {/* New Chat Button - Tooltip removed */}
          <Button
            appearance="subtle"
            aria-label={t('Chat.New') + ' (Ctrl+N)'}
            icon={<ChatAddIcon />}
            className={collapsed ? buttonClasses : `flex-grow justify-start hover:bg-black/10 dark:hover:bg-white/10`}
            onClick={() => navigate(`/chats/${tempChatId}`)}
          >
            {collapsed ? null : t('Chat.New') + ' (Ctrl+N)'}
          </Button>
          
          {/* Global Search Button - visible only when expanded */}
          {!collapsed && (
            <Tooltip
              content={
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Search')}</div>
                  <div>Global search (Ctrl+Alt+S)</div>
                </div>
              }
              relationship="description"
              positioning="above"
            >
              <Button
                appearance="subtle"
                icon={<SearchIcon />}
                aria-label="Global Search"
                className={`${buttonClasses} mt-1`} // Keep margin for now, adjust if needed
                style={{ flexGrow: 0 }} // Don't let search grow
                onClick={() => setSearchOpen(true)}
              >
                {/* Text removed, only icon shown */}
              </Button>
            </Tooltip>
          )}
          
          {/* Create Folder Button - visible only when expanded */}
          {!collapsed && (
            <Tooltip
              content={t('Chat.CreateFolder')}
              relationship="label"
              positioning="above"
            >
              <Button
                appearance="subtle"
                icon={<FolderAdd16Regular />}
                onClick={() => setIsCreateFolderDialogOpen(true)}
                className={buttonClasses}
                style={{ flexGrow: 0 }} // Don't let it grow
              >
              </Button>
            </Tooltip>
          )}
        </div>

        {/* Search Button - RENDERED HERE ONLY WHEN COLLAPSED */}
        {collapsed && (
          <div className={`flex justify-center px-1 mt-2`}> 
            <Tooltip
              content={
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Search')}</div>
                  <div>Global search (Ctrl+Alt+S)</div>
                </div>
              }
              relationship="description"
              positioning="above"
            >
              <Button
                appearance="subtle"
                icon={<SearchIcon />}
                aria-label="Global Search"
                className={buttonClasses}
                onClick={() => setSearchOpen(true)}
              >
                {/* Text removed, only icon shown */}
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
      
      {/* Create Folder Dialog */}
      <Dialog 
        open={isCreateFolderDialogOpen}
        onOpenChange={(event, data) => setIsCreateFolderDialogOpen(data.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t('Chat.CreateFolder')}</DialogTitle>
            <DialogContent>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder={t('Chat.FolderNamePlaceholder')}
              />
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsCreateFolderDialogOpen(false)}>
                {t('Common.Cancel')}
              </Button>
              <Button appearance="primary" onClick={handleCreateFolder}>
                {t('Common.Create')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Search Dialog */}
      {searchOpen && (
        <SearchDialog
          open={searchOpen}
          setOpen={setSearchOpen}
        />
      )}
    </div>
  );
}
