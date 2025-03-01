import React, { useEffect, useState, useCallback } from 'react';
import { Button, Tooltip } from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  MoreHorizontal24Regular,
  MoreHorizontal24Filled,
  FilterDismiss24Regular,
  Info24Regular,
  Info24Filled,
  Delete24Regular,
  Delete24Filled,
  Search24Regular,
  bundleIcon,
} from '@fluentui/react-icons';
import useAppearanceStore from 'stores/useAppearanceStore';
import useChatStore from 'stores/useChatStore';
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
const InfoIcon = bundleIcon(Info24Filled, Info24Regular);

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
    Mousetrap.bind('mod+f', handleOpenSearch);
    
    // Clean up event listeners
    return () => {
      Mousetrap.unbind('mod+d');
      Mousetrap.unbind('mod+shift+r');
      Mousetrap.unbind('mod+f');
    };
  }, [activeChatId, toggleChatSidebarVisibility, handleOpenSearch]);

  return (
    <div
      className={`chat-header absolute p-2.5 -mx-2.5 flex justify-end items-center ${
        collapsed
          ? 'left-[12rem] md:left-[5rem]'
          : 'left-[12rem] md:left-0 lg:left-0'
      }`}
    >
      <div className="flex justify-end items-center gap-1">
        {/* Show delete button for all chats except tempChatId (new chat) */}
        {activeChatId !== tempChatId && (
          <Button
            icon={<DeleteIcon className="text-color-tertiary" />}
            appearance="transparent"
            title="Mod+d"
            onClick={() => handleDeleteConfirm(true)}
          />
        )}
        {/* Show filter clear button if keyword exists */}
        {keyword ? (
          <Tooltip content={t('Common.ClearFilter')} relationship="label">
            <Button
              icon={<FilterDismiss24Regular />}
              appearance="subtle"
              onClick={handleClearFilter}
            />
          </Tooltip>
        ) : null}
        <Tooltip content={t('Common.Search')} relationship="label">
          <Button
            icon={<Search24Regular className="text-color-tertiary" />}
            appearance="transparent"
            title="Mod+f"
            onClick={handleOpenSearch}
          />
        </Tooltip>
        <Button
          icon={<MoreHorizontalIcon className="text-color-tertiary"/>}
          appearance="subtle"
          onClick={handleOpenDrawer}
        />
        <div className="hidden sm:block">
          <Tooltip content={t('Common.Inspector')} relationship="label">
            <Button
              icon={<InfoIcon className="text-color-tertiary" />}
              appearance="transparent"
              title="Mod+shift+r"
              onClick={toggleChatSidebarVisibility}
            />
          </Tooltip>
        </div>
      </div>
      <ChatSettingsDrawer open={drawerOpen} setOpen={handleCloseDrawer} />
      {/* Pass the current chatId to SearchDialog for single-chat search */}
      <SearchDialog open={searchOpen} setOpen={handleCloseSearch} chatId={activeChatId} />
      <ConfirmDialog
        open={delConfirmDialogOpen}
        setOpen={handleDeleteConfirm}
        title={t('Chat.DeleteConfirmation')}
        message={t('Chat.DeleteConfirmationInfo')}
        onConfirm={onDeleteChat}
      />
    </div>
  );
};

export default Header; 