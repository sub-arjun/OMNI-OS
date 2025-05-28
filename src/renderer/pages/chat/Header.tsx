import React, { useEffect, useState, useCallback } from 'react';
import { Button, Tooltip, Menu, MenuTrigger, MenuList, MenuItem, MenuPopover } from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  MoreHorizontal24Regular,
  MoreHorizontal24Filled,
  FilterDismiss24Regular,
  Info24Regular,
  Info24Filled,
  Dismiss24Regular,
  Delete24Regular,
  Delete24Filled,
  Search24Regular,
  TextDescription24Regular,
  TextDescription24Filled,
  bundleIcon,
  FolderAdd24Regular,
  FolderAdd24Filled,
  ChevronRight12Regular
} from '@fluentui/react-icons';
import useAppearanceStore from 'stores/useAppearanceStore';
import useChatStore, { IChatFolder } from 'stores/useChatStore';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from 'renderer/components/ConfirmDialog';

import { tempChatId } from 'consts';
import useNav from 'hooks/useNav';
import useToast from 'hooks/useToast';
import ChatSettingsDrawer from './ChatSettingsDrawer';
import SearchDialog from 'renderer/components/SearchDialog';
import { useParams } from 'react-router-dom';

// Bundle icons outside component
const DeleteIcon = bundleIcon(Delete24Filled, Delete24Regular);
const MoreHorizontalIcon = bundleIcon(
  MoreHorizontal24Filled,
  MoreHorizontal24Regular,
);
const FolderAddIcon = bundleIcon(FolderAdd24Filled, FolderAdd24Regular);

// Bundle the new icon for system prompt
const SystemPromptIcon = bundleIcon(TextDescription24Filled, TextDescription24Regular);

// Re-add InfoIcon bundle
const InfoIcon = bundleIcon(Info24Filled, Info24Regular);

// Define DismissIcon bundle
const DismissIcon = bundleIcon(Dismiss24Regular, Dismiss24Regular); // Assuming no filled variant needed for toggle

// Header component with direct connection to chat store
const Header = () => {
  const { t } = useTranslation();
  const { notifySuccess } = useToast();
  const navigate = useNav();
  
  // Get chat ID directly from URL params for immediate updates
  const { id: chatIdFromParams } = useParams<{ id: string }>();
  const activeChatId = chatIdFromParams || tempChatId;
  
  // Get chat directly from store
  const chat = useChatStore(state => state.chat);
  const isPersisted = !!(activeChatId && activeChatId !== tempChatId);
  
  const collapsed = useAppearanceStore((state) => state.sidebar.collapsed);
  const chatSidebarHidden = useAppearanceStore(
    (state) => state.chatSidebar.show,
  );
  const toggleChatSidebarVisibility = useAppearanceStore(
    (state) => state.toggleChatSidebarVisibility,
  );
  
  // Force component to update when chat ID changes
  useEffect(() => {
    // This empty effect with activeChatId dependency will
    // ensure the component re-renders when the chat ID changes
  }, [activeChatId]);
  
  // State hooks
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [delConfirmDialogOpen, setDelConfirmDialogOpen] = useState(false);
  
  // Store hooks
  const deleteChat = useChatStore((state) => state.deleteChat);
  const getKeyword = useChatStore((state) => state.getKeyword);
  const setKeyword = useChatStore((state) => state.setKeyword);
  const folders = useChatStore((state) => state.folders);
  const fetchFolders = useChatStore((state) => state.fetchFolders);
  const assignChatToFolder = useChatStore((state) => state.assignChatToFolder);

  // Fetch folders when component mounts
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // Callbacks
  const onDeleteChat = useCallback(async () => {
    await deleteChat();
    navigate(`/chats/${tempChatId}`);
    notifySuccess(t('Chat.Notification.Deleted'));
  }, [deleteChat, navigate, notifySuccess, t]);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleOpenDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback((open: boolean) => {
    setDrawerOpen(open);
  }, []);

  const handleCloseSearch = useCallback((open: boolean) => {
    setSearchOpen(open);
  }, []);

  const handleDeleteConfirm = useCallback((open: boolean) => {
    setDelConfirmDialogOpen(open);
  }, []);

  const handleClearFilter = useCallback(() => {
    if (activeChatId) {
      setKeyword(activeChatId, '');
    }
  }, [activeChatId, setKeyword]);

  const handleAssignToFolder = useCallback((folderId: string | null) => {
    if (activeChatId && activeChatId !== tempChatId) {
      assignChatToFolder(activeChatId, folderId);
      notifySuccess(folderId ? t('Chat.Notification.AddedToFolder') : t('Chat.Notification.RemovedFromFolder'));
    }
  }, [activeChatId, assignChatToFolder, notifySuccess, t]);

  // Get keyword for current chat
  const keyword = isPersisted ? getKeyword(activeChatId) : null;

  // Setup keyboard shortcuts
  useEffect(() => {
    const handleDelete = () => {
      if (activeChatId !== tempChatId) {
        setDelConfirmDialogOpen(true);
      }
    };
    
    Mousetrap.bind('mod+d', handleDelete);
    Mousetrap.bind('mod+shift+r', toggleChatSidebarVisibility);
    Mousetrap.bind('ctrl+f', (e) => { // Capture event
      // Prevent browser's default find action
      if (e.preventDefault) {
        e.preventDefault();
      } else {
        e.returnValue = false; // For IE
      }
      handleOpenSearch(); // Open in-conversation search
      return false; // Stop propagation
    });
    
    // Clean up event listeners
    return () => {
      Mousetrap.unbind('mod+d');
      Mousetrap.unbind('mod+shift+r');
      Mousetrap.unbind('ctrl+f');
    };
  }, [activeChatId, toggleChatSidebarVisibility, handleOpenSearch]);

  return (
    <>
      {/* Keep original header container for layout but make it transparent */}
      <div
        className={`chat-header flex justify-end items-center opacity-0 ${
          collapsed
            ? 'left-[12rem] md:left-[5rem]'
            : 'left-[12rem] md:left-0 lg:left-0'
        }`}
      >
        <div className="action-buttons-container">
          {/* Empty container for layout */}
        </div>
      </div>
      
      {/* Improved buttonbar overlay - styled to match original */}
      <div 
        style={{
          position: 'absolute',
          top: '8px',
          right: '16px',
          zIndex: 1000,
          display: 'flex',
          gap: '2px',
          background: 'rgba(var(--color-bg-base), 0.65)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          borderRadius: '8px',
          padding: '3px 6px',
          border: '1px solid rgba(var(--color-border), 0.15)',
          boxShadow: '0 3px 12px rgba(0, 0, 0, 0.07)',
        } as React.CSSProperties}
      >
        {/* In-conversation search button - NOW LEFTMOST IN TOOLBAR */}
        {isPersisted && (
          <Tooltip
            content={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Chat.InConversationSearch')}</div>
                <div>Search within this conversation (Ctrl+F)</div>
              </div>
            }
            relationship="description"
            positioning="above"
          >
            <button
              onClick={handleOpenSearch}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '6px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-secondary)',
                transition: 'all 0.2s ease'
              } as React.CSSProperties}
              title={t('Chat.InConversationSearch')}
              data-testid="in-chat-search-btn"
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--color-bg-surface-1), 0.4)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Search24Regular />
            </button>
          </Tooltip>
        )}
        
        {/* Delete button */}
        {activeChatId !== tempChatId && (
          <>
            <button
              onClick={() => handleDeleteConfirm(true)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '6px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-secondary)',
                transition: 'all 0.2s ease'
              } as React.CSSProperties}
              title="Delete chat (Mod+d)"
              data-testid="delete-chat-btn"
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--color-bg-surface-1), 0.4)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <DeleteIcon />
            </button>
            
            {/* Folder button with dropdown */}
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <button
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-secondary)',
                    transition: 'all 0.2s ease'
                  } as React.CSSProperties}
                  title={t('Chat.MoveToFolder')}
                  data-testid="folder-add-btn"
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--color-bg-surface-1), 0.4)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FolderAddIcon />
                </button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {/* Option to remove from current folder */}
                  {chat.folderId && (
                    <MenuItem onClick={() => handleAssignToFolder(null)}>
                      {t('Chat.RemoveFromFolder')}
                    </MenuItem>
                  )}
                  {/* Separator if needed */}
                  {chat.folderId && folders.length > 0 && <hr className="my-1 border-gray-200 dark:border-gray-700" />}
                  {/* List all available folders */}
                  {folders.map(folder => (
                    <MenuItem
                      key={folder.id}
                      onClick={() => handleAssignToFolder(folder.id)}
                      className={chat.folderId === folder.id ? 'bg-accent-alpha' : ''}
                    >
                      {folder.name}
                    </MenuItem>
                  ))}
                  {/* Show message if no folders exist and chat isn't already in one */}
                  {!folders || folders.length === 0 && !chat.folderId && (
                    <MenuItem disabled>
                      {t('Chat.NoFoldersYet')}
                    </MenuItem>
                  )}
                </MenuList>
              </MenuPopover>
            </Menu>
          </>
        )}
        
        {/* Filter clear button */}
        {keyword ? (
          <button
            onClick={handleClearFilter}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              transition: 'all 0.2s ease'
            } as React.CSSProperties}
            title={t('Common.ClearFilter')}
            data-testid="clear-filter-btn"
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--color-bg-surface-1), 0.4)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FilterDismiss24Regular />
          </button>
        ) : null}
        
        {/* System prompt button */}
        <Tooltip 
          content={
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Instructions')}</div>
              <div>Define instructions for the AI's behavior</div>
              <div style={{ marginTop: '3px', fontSize: '12px', opacity: 0.8 }}>
                Customize model responses and personality
              </div>
            </div>
          }
          relationship="description"
          positioning="above"
        >
          <button
            onClick={handleOpenDrawer}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              transition: 'all 0.2s ease'
            } as React.CSSProperties}
            title={t('Common.Instructions') || "Instructions"}
            data-testid="system-prompt-btn"
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--color-bg-surface-1), 0.4)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <SystemPromptIcon />
          </button>
        </Tooltip>
        
        {/* Inspector Toggle Button (Now with Dismiss Icon) */}
        <Tooltip 
          content={
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Inspector')}</div>
              <div>{chatSidebarHidden ? 'Close' : 'Open'} Inspector (Ctrl+Shift+R)</div>
              <div style={{ marginTop: '3px', fontSize: '12px', opacity: 0.8 }}>
                View model thoughts & tool usage
              </div>
            </div>
          }
          relationship="description"
          positioning="above"
        >
          <button
            onClick={toggleChatSidebarVisibility}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              transition: 'all 0.2s ease'
            } as React.CSSProperties}
            title={`${chatSidebarHidden ? 'Close' : 'Open'} Inspector`}
            data-testid="inspector-toggle-btn"
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--color-bg-surface-1), 0.4)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {/* Conditionally render Dismiss or Info icon */}
            {chatSidebarHidden ? <DismissIcon /> : <InfoIcon />}
          </button>
        </Tooltip>
      </div>
      
      {/* Dialogs */}
      <ChatSettingsDrawer open={drawerOpen} setOpen={handleCloseDrawer} />
      <SearchDialog open={searchOpen} setOpen={handleCloseSearch} chatId={activeChatId} />
      <ConfirmDialog
        open={delConfirmDialogOpen}
        setOpen={handleDeleteConfirm}
        title={t('Chat.DeleteConfirmation')}
        message={t('Chat.DeleteConfirmationInfo')}
        onConfirm={onDeleteChat}
      />
    </>
  );
};

export default Header;