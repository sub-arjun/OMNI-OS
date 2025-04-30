import React from 'react';
import { useTranslation } from 'react-i18next';
import { IChat, IChatFolder } from 'types';
import { tempChatId } from 'consts';
import ChatItem from './ChatItem';

// Ungrouped chats area component
const UngroupedArea = ({ 
  chats, 
  currentChatId,
  folders,
  onMoveToFolder,
  onDeleteChat,
  collapsed 
}: { 
  chats: IChat[],
  currentChatId: string,
  folders: IChatFolder[],
  onMoveToFolder: (chatId: string, folderId: string | null) => void,
  onDeleteChat: (chatId: string) => void,
  collapsed: boolean
}) => {
  const { t } = useTranslation();
  
  if (chats.length === 0) return null;
  
  return (
    <div className="ungrouped-chats-container">
      {!collapsed && (
        <div className="pl-0.5 pr-2 mb-2">
          <div className="ungrouped-chats-title text-xs text-gray-500 opacity-70 ml-1 mb-1">
            {t('Chat.UngroupedChats', 'Ungrouped Chats')}
          </div>
        </div>
      )}
      
      <div className={`ungrouped-chats ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {chats.map((chat) => (
          <ChatItem 
            key={chat.id} 
            chat={chat} 
            isActive={chat.id === currentChatId}
            folders={folders}
            onMoveToFolder={onMoveToFolder}
            onDeleteChat={onDeleteChat}
            collapsed={collapsed}
          />
        ))}
      </div>
    </div>
  );
};

export default UngroupedArea; 