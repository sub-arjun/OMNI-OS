import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Menu,
  MenuTrigger,
  MenuList,
  MenuItem,
  MenuPopover,
} from '@fluentui/react-components';
import {
  Folder20Regular,
  Folder20Filled,
  Edit20Regular,
  Delete20Regular,
  ChevronDown20Regular,
  ChevronRight20Regular,
  MoreVertical20Regular,
} from '@fluentui/react-icons';
import { IChatFolder, IChat } from 'types';
import ChatItem from './ChatItem';

// Folder component
const FolderComponent = ({ 
  folder, 
  chats, 
  isExpanded, 
  onToggle, 
  onContextMenu,
  onRenameFolder,
  onDeleteFolder,
  currentChatId,
  folders,
  onMoveToFolder,
  onDeleteChat,
  collapsed 
}: { 
  folder: IChatFolder, 
  chats: IChat[],
  isExpanded: boolean,
  onToggle: () => void,
  onContextMenu: (folder: IChatFolder) => void,
  onRenameFolder: (folder: IChatFolder) => void,
  onDeleteFolder: (folderId: string) => void,
  currentChatId: string,
  folders: IChatFolder[],
  onMoveToFolder: (chatId: string, folderId: string | null) => void,
  onDeleteChat: (chatId: string) => void,
  collapsed: boolean
}) => {
  const { t } = useTranslation();
  
  return (
    <div className={`mb-1 ${collapsed ? 'flex flex-col items-center w-full' : ''} folder-container`}>
      <div 
        className={`py-0 flex items-center cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 rounded-md relative ${
          collapsed ? 'justify-center w-full px-0' : 'pl-0.5 pr-2'
        } folder-header`}
        onClick={onToggle}
      >
        {/* Show chevron only when not collapsed */}
        {!collapsed && (
          <Button 
            appearance="subtle" 
            size="small"
            icon={isExpanded ? 
              <ChevronDown20Regular className="chevron-icon rotate-icon" /> : 
              <ChevronRight20Regular className="chevron-icon rotate-icon" />
            }
            className="p-0 min-w-[20px] h-5 mr-0.5 folder-item"
            style={{ 
              backgroundColor: 'transparent',
              boxShadow: 'none',
              borderColor: 'transparent',
              padding: '0',
              margin: '0',
              marginRight: '2px'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          />
        )}
        
        {/* Folder icon and name */}
        <div 
          className={`flex items-center ${collapsed ? 'mx-auto' : 'flex-grow'} folder-item`}
          style={{ 
            paddingRight: collapsed ? '0' : '28px',
            width: collapsed ? '48px' : 'auto',
            height: collapsed ? '34px' : 'auto',
            justifyContent: collapsed ? 'center' : 'flex-start'
          }}
        >
          {isExpanded ? 
            <Folder20Filled className="folder-icon-filled" /> : 
            <Folder20Regular className="folder-icon" />
          }
          {!collapsed && <span className="ml-2 font-medium truncate folder-name">{folder.name}</span>}
        </div>
        
        {/* Add three dots menu */}
        {!collapsed && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                size="small"
                icon={<MoreVertical20Regular className="menu-icon" />}
                className="ml-0 p-0 opacity-60 hover:opacity-100 chat-menu-button absolute folder-menu"
                style={{ 
                  backgroundColor: 'transparent !important',
                  background: 'transparent !important',
                  boxShadow: 'none !important',
                  borderColor: 'transparent !important',
                  border: 'none !important',
                  color: 'inherit !important',
                  minWidth: '20px !important',
                  width: '20px !important',
                  height: '20px !important',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 20,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem 
                  icon={<Edit20Regular />}
                  onClick={() => onRenameFolder(folder)}
                >
                  {t('Common.Rename')}
                </MenuItem>
                <MenuItem 
                  icon={<Delete20Regular />}
                  onClick={() => onDeleteFolder(folder.id)}
                >
                  {t('Common.Delete')}
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
      
      {isExpanded && (
        <div className={`folder-content ${collapsed ? 'flex flex-col items-center w-full' : 'pl-3'}`}>
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
      )}
    </div>
  );
};

export default FolderComponent; 