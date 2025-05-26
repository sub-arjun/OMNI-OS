import { useEffect, useState, useCallback } from 'react';
import useNav from 'hooks/useNav';
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
import {
  Chat20Regular,
  Chat20Filled,
  Person20Regular,
  Bot20Regular,
  Add20Regular,
  Folder20Regular,
  Folder20Filled,
  FolderAdd20Regular,
  FolderAdd20Filled,
  Edit20Regular,
  Delete20Regular,
  ChevronDown20Regular,
  ChevronRight20Regular,
  MoreVertical20Regular,
  ChevronRight12Regular,
} from '@fluentui/react-icons';
import useChatStore, { IChatFolder } from 'stores/useChatStore';
import { IChat } from 'intellichat/types';
import Mousetrap from 'mousetrap';
import { findIndex } from 'lodash';
import { useTranslation } from 'react-i18next';
import { tempChatId } from 'consts';
import { debounce } from 'lodash';

// Function to determine if a chat is from the user or agent based on summary content
const isChatFromAgent = (summary: string | undefined) => {
  if (!summary) return false;
  // Check for common agent-initiated patterns
  return summary.toLowerCase().includes('assistant') || 
         summary.toLowerCase().includes('ai') ||
         summary.toLowerCase().includes('generated') ||
         summary.toLowerCase().includes('created');
};

// Chat item component
const ChatItem = ({ 
  chat, 
  isActive, 
  folders,
  onMoveToFolder,
  onDeleteChat,
  collapsed 
}: { 
  chat: IChat, 
  isActive: boolean,
  folders: IChatFolder[],
  onMoveToFolder: (chatId: string, folderId: string | null) => void,
  onDeleteChat: (chatId: string) => void,
  collapsed: boolean 
}) => {
  const navigate = useNav();
  const { t } = useTranslation();
  const isAgentChat = isChatFromAgent(chat.summary);
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  
  // Handle folder selection - simpler direct implementation
  const handleFolderSelect = (folderId: string | null) => {
    console.log("Moving chat to folder:", chat.id, folderId);
    onMoveToFolder(chat.id, folderId);
    setIsSubMenuOpen(false); // Close submenu after selection
  };
  
  const renderIconWithTooltip = (chat: IChat) => {
    const isAgentChat = isChatFromAgent(chat.summary);
    return (
      <Tooltip
        withArrow
        content={chat.summary?.substring(0, 200) || "New Chat"}
        relationship="label"
        positioning={collapsed ? "after" : "above-start"}
      >
        {isActive ? 
          <Chat20Filled className="animate-icon" /> : 
          (isAgentChat ? <Bot20Regular className="animate-icon" /> : <Person20Regular className="animate-icon" />)
        }
      </Tooltip>
    );
  };
  
  return (
    <div
      className={`my-0 ${collapsed ? 'flex justify-center w-full px-0' : 'pl-0.5 pr-2'} ${
        isActive ? 'active' : ''
      } chat-item-container`}
      key={chat.id}
      style={{position: 'relative'}}
    >
      <div className={`flex relative ${collapsed ? 'justify-center' : ''}`} style={{minHeight: '34px'}}>
        <Button
          icon={renderIconWithTooltip(chat)}
          appearance="subtle"
          className={`${collapsed ? 'w-12 h-12 p-0 flex justify-center items-center' : 'flex-grow justify-start'} latin hover:bg-black/10 dark:hover:bg-white/10 chat-item ${
            isAgentChat ? 'agent-chat' : 'user-chat'
          }`}
          style={{ 
            paddingRight: collapsed ? '0' : '36px', // Space for menu button only when not collapsed
            minWidth: collapsed ? '48px' : 'auto',
            height: collapsed ? 'auto' : '34px',
            ...(isActive ? { 
              backgroundColor: 'rgba(59, 130, 246, 0.25)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              transform: 'translateX(2px)',
              width: '100%'
            } : {})
          }}
          onClick={() => navigate(`/chats/${chat.id}`)}
        >
          {collapsed ? null : (
            <div className="text-sm truncate chat-summary">
              {chat.summary?.substring(0, 40)}
            </div>
          )}
        </Button>
        
        {!collapsed && chat.id !== tempChatId && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                size="small"
                icon={<MoreVertical20Regular className="menu-icon" />}
                aria-label="Menu"
                className="chat-menu-button"
                style={{ 
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '20px',
                  height: '20px',
                  minWidth: '20px',
                  minHeight: '20px',
                  maxWidth: '20px',
                  maxHeight: '20px',
                  padding: '0',
                  margin: '0',
                  backgroundColor: 'transparent',
                  background: 'transparent',
                  boxShadow: 'none',
                  borderColor: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  zIndex: 10,
                  opacity: 0.6,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.6';
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                }}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {/* Proper nested menu for folder selection */}
                <Menu open={isSubMenuOpen} onOpenChange={(e, data) => setIsSubMenuOpen(data.open)}>
                  <MenuTrigger disableButtonEnhancement>
                    <MenuItem icon={<Folder20Regular />}>
                      {t('Chat.MoveToFolder')}
                    </MenuItem>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      {/* Option to remove from folder */}
                      {chat.folderId && (
                        <MenuItem onClick={() => handleFolderSelect(null)}>
                          {t('Chat.RemoveFromFolder')}
                        </MenuItem>
                      )}
                      
                      {/* Separator between remove option and folders */}
                      {chat.folderId && folders && folders.length > 0 && (
                        <hr className="my-1 border-t border-gray-200 dark:border-gray-700" />
                      )}
                      
                      {/* Available folders */}
                      {folders && folders.length > 0 ? (
                        folders.map(folder => (
                          <MenuItem
                            key={folder.id}
                            onClick={() => handleFolderSelect(folder.id)}
                            className={chat.folderId === folder.id ? 'bg-accent-alpha' : ''}
                          >
                            {folder.name}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem disabled>
                          {t('Chat.NoFoldersYet')}
                        </MenuItem>
                      )}
                    </MenuList>
                  </MenuPopover>
                </Menu>
                
                {/* Separator */}
                <hr className="my-1 border-t border-gray-200 dark:border-gray-700" />
                
                {/* Delete option */}
                <MenuItem 
                  icon={<Delete20Regular />}
                  onClick={() => onDeleteChat(chat.id)}
                >
                  {t('Common.Delete')}
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
    </div>
  );
};

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
    <div className={`mb-0.5 ${collapsed ? 'flex flex-col items-center w-full' : ''} folder-container`}>
      <div 
        className={`flex items-center cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 rounded-md relative ${
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
            className="p-1 min-w-[20px] h-5 mr-0.5 folder-item"
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
            height: collapsed ? '34px' : '32px',
            justifyContent: collapsed ? 'center' : 'flex-start'
          }}
        >
          {collapsed ? (
            <Tooltip
              withArrow
              content={folder.name}
              relationship="label"
              positioning="after"
            >
              {isExpanded ? 
                <Folder20Filled className="folder-icon-filled" /> : 
                <Folder20Regular className="folder-icon" />
              }
            </Tooltip>
          ) : (
            <>
              {isExpanded ? 
                <Folder20Filled className="folder-icon-filled" /> : 
                <Folder20Regular className="folder-icon" />
              }
              <span className="ml-2 font-medium truncate folder-name">{folder.name}</span>
            </>
          )}
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
                  zIndex: 10,
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

// Ungrouped chats area
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
  
  if (chats.length === 0) return null;
  
  return (
    <div className="mb-2 mt-0.5">
      <div className={collapsed ? 'text-center' : ''}>
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

export default function ChatNav({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const chats = useChatStore((state) => state.chats);
  const storefolders = useChatStore((state) => state.folders);
  const fetchFolders = useChatStore((state) => state.fetchFolders);
  const createFolder = useChatStore((state) => state.createFolder);
  const updateFolder = useChatStore((state) => state.updateFolder);
  const deleteFolder = useChatStore((state) => state.deleteFolder);
  const currentChat = useChatStore((state) => state.chat);
  const fetchChat = useChatStore((state) => state.fetchChat);
  const assignChatToFolder = useChatStore((state) => state.assignChatToFolder);
  const folderOperationInProgress = useChatStore((state) => state.folderOperationInProgress);
  const navigate = useNav();
  
  // Local state to ensure re-rendering
  const [localFolders, setLocalFolders] = useState<IChatFolder[]>([]);
  
  // Use the merged folders for rendering - always prioritize local folders for stability
  const folders = localFolders.length > 0 ? localFolders : (storefolders || []);
  
  // Dialog states
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const [isRenameFolderDialogOpen, setIsRenameFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  // Context menu states
  const [selectedFolder, setSelectedFolder] = useState<IChatFolder | null>(null);
  
  // Track expanded folder states with localStorage persistence
  const [expandedFolders, setExpandedFolders] = useState<{[key: string]: boolean}>(() => {
    try {
      // Load expanded state from localStorage
      const savedState = localStorage.getItem('expandedFolders');
      return savedState ? JSON.parse(savedState) : {};
    } catch (e) {
      console.error('Error loading folder expanded states:', e);
      return {};
    }
  });
  
  // Create debounced functions 
  const debouncedFetchChat = useCallback(
    debounce(async () => {
      try {
        await fetchChat();
      } catch (err) {
        console.error("Error in debounced fetchChat:", err);
      }
    }, 1000),
    [fetchChat]
  );
  
  const debouncedFetchFolders = useCallback(
    debounce(async () => {
      try {
        const fetchedFolders = await fetchFolders();
        if (fetchedFolders && fetchedFolders.length > 0) {
          setLocalFolders(fetchedFolders);
        }
      } catch (err) {
        console.error("Error in debounced fetchFolders:", err);
      }
    }, 1000),
    [fetchFolders]
  );
  
  // Add global style to prevent menu button highlighting
  useEffect(() => {
    // Create style element if it doesn't exist
    let styleElement = document.getElementById('chat-menu-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'chat-menu-styles';
      document.head.appendChild(styleElement);
    }
    
    // Add styles for the menu button
    styleElement.innerHTML = `
      /* Fix button dimensions to be consistent in all states */
      .chat-menu-button,
      .active .chat-menu-button,
      .folder-menu,
      .active .folder-menu,
      div .chat-menu-button,
      button.chat-menu-button,
      .fui-Button.chat-menu-button,
      *[class*="fui-Button"].chat-menu-button {
        width: 20px !important;
        height: 20px !important;
        min-width: 20px !important;
        min-height: 20px !important;
        max-width: 20px !important;
        max-height: 20px !important;
        padding: 0 !important;
        margin: 0 !important;
        background-color: transparent !important;
        background-image: none !important;
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
        border-color: transparent !important;
        outline: none !important;
        position: absolute !important;
        right: 8px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        z-index: 11 !important;
        transition: none !important;
      }
      
      /* Ultra-specific rule to prevent any buttons in active states from being highlighted */
      .chat-list-container .active button,
      .chat-list-container .active button.fui-Button,
      .chat-list-container .active .fui-Button,
      .chat-list-container .active button[class*="fui-Button"],
      .chat-list-container .active *[class*="fui-Button"],
      .folder-content .active button,
      .folder-content .active button.fui-Button,
      .folder-content .active .folder-menu,
      .folder-content .active button.folder-menu,
      html body .chat-list-container .active button,
      html body .chat-list-container .active button.chat-menu-button,
      html body .folder-content .active button.folder-menu {
        background-color: transparent !important;
        background: transparent !important;
        box-shadow: none !important;
        border-color: transparent !important;
        outline: none !important;
        background-image: none !important;
        border: none !important;
      }
      
      /* Ensure menu button icon is properly sized */
      .chat-menu-button svg,
      .active .chat-menu-button svg {
        width: 20px !important;
        height: 20px !important;
        min-width: 20px !important;
        min-height: 20px !important;
      }
      
      /* Fix parent container size */
      .chat-list-container .flex.relative {
        position: relative !important;
        min-height: 32px !important;
      }
      
      /* Prevent any animations or transitions */
      .chat-menu-button *,
      .chat-menu-button svg,
      .chat-menu-button span {
        transition: none !important;
        transform: none !important;
      }
      
      /* Ensure hover behavior still works */
      .chat-list-container .active button:hover {
        background-color: rgba(0, 0, 0, 0.05) !important;
        background: rgba(0, 0, 0, 0.05) !important;
      }
      
      .chat-list-container.dark .active button:hover,
      .dark .chat-list-container .active button:hover {
        background-color: rgba(255, 255, 255, 0.1) !important;
        background: rgba(255, 255, 255, 0.1) !important;
      }
    `;
    
    return () => {
      if (styleElement && document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);
  
  // Save expanded state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('expandedFolders', JSON.stringify(expandedFolders));
    } catch (e) {
      console.error('Error saving folder expanded states:', e);
    }
  }, [expandedFolders]);
  
  // Fetch chats and folders on mount
  useEffect(() => {
    console.log('[ChatNav] Component mounted - initial render');
    
    let isMounted = true;
    
    const loadData = async () => {
      try {
        if (isMounted) {
          await fetchChat();
          const fetchedFolders = await fetchFolders();
          if (isMounted && fetchedFolders && fetchedFolders.length > 0) {
            setLocalFolders(fetchedFolders);
          }
        }
      } catch (err) {
        console.error("Error loading initial data:", err);
      }
    };
    
    loadData();
    
    // Set up an interval to periodically refresh folders
    const intervalId = setInterval(async () => {
      if (isMounted) {
        try {
          const fetchedFolders = await fetchFolders();
          if (isMounted && fetchedFolders && fetchedFolders.length > 0) {
            setLocalFolders(fetchedFolders);
          }
        } catch (err) {
          console.error("Error refreshing folders:", err);
        }
      }
    }, 15000); // Refresh every 15 seconds
    
    return () => {
      console.log('[ChatNav] Component unmounting');
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [fetchChat, fetchFolders]);
  
  // Sync local folder state with store folders
  useEffect(() => {
    if (storefolders && storefolders.length > 0) {
      console.log("Store folders updated:", storefolders);
      setLocalFolders(storefolders);
    }
  }, [storefolders]);
  
  // Keyboard navigation
  useEffect(() => {
    Mousetrap.bind('mod+shift+up', () => {
      let index = 0;
      if (chats.length) {
        if (currentChat) {
          const curIdx = findIndex(
            chats,
            (item: IChat) => item.id === currentChat.id
          );
          index = Math.max(curIdx - 1, 0);
        }
        navigate(`/chats/${chats[index].id}`);
      }
    });
    Mousetrap.bind('mod+shift+down', () => {
      let index = 0;
      if (chats.length) {
        if (currentChat) {
          const curIdx = findIndex(
            chats,
            (item: IChat) => item.id === currentChat.id
          );
          index = Math.min(curIdx + 1, chats.length - 1);
        }
        navigate(`/chats/${chats[index].id}`);
      }
    });
    return () => {
      Mousetrap.unbind('mod+shift+up');
      Mousetrap.unbind('mod+shift+down');
    };
  }, [chats, currentChat, navigate]);
  
  // Create new folder
  const handleCreateFolder = async () => {
    if (folderName.trim()) {
      try {
        console.log("Creating folder:", folderName.trim());
        const newFolder = await createFolder(folderName.trim());
        console.log("Created folder:", newFolder);
        
        // Immediately update local state rather than waiting for refresh
        if (newFolder) {
          setLocalFolders(prev => [newFolder, ...prev]);
          
          // Auto-expand the new folder
          setExpandedFolders(prev => ({
            ...prev,
            [newFolder.id]: true
          }));
        }
        
        setFolderName('');
        setIsCreateFolderDialogOpen(false);
        
        // Use debounced fetch instead of immediate refresh
        debouncedFetchFolders();
      } catch (err) {
        console.error("Error creating folder:", err);
      }
    }
  };
  
  // Update the openRenameDialog function to be more robust
  const openRenameDialog = (folder: IChatFolder) => {
    console.log("Opening rename dialog for folder:", folder);
    setSelectedFolder(null); // Close the context menu first
    setCurrentFolderId(folder.id);
    setFolderName(folder.name);
    setIsRenameFolderDialogOpen(true);
  };
  
  // Rename folder
  const handleRenameFolder = async () => {
    if (folderName.trim() && currentFolderId) {
      try {
        console.log("Renaming folder", currentFolderId, "to", folderName.trim());
        
        // Find the current folder to update
        const folderToUpdate = folders.find(f => f.id === currentFolderId);
        if (!folderToUpdate) {
          console.error("Cannot find folder to rename:", currentFolderId);
          return;
        }

        // Optimistically update UI first
        const updatedFolder = { ...folderToUpdate, name: folderName.trim() };
        setLocalFolders(prev => 
          prev.map(f => f.id === currentFolderId ? updatedFolder : f)
        );
        
        // Then update in database
        await updateFolder({ id: currentFolderId, name: folderName.trim() });
        console.log("Successfully renamed folder in database");
        
        setFolderName('');
        setCurrentFolderId(null);
        setIsRenameFolderDialogOpen(false);
        
        // Use debounced fetch instead of immediate refresh
        debouncedFetchFolders();
      } catch (err) {
        console.error("Error renaming folder:", err);
      }
    } else {
      console.warn("Invalid folder name or missing folder ID");
    }
  };
  
  // Delete folder
  const handleDeleteFolder = async (folderId: string) => {
    if (folderOperationInProgress) return; // Prevent multiple operations
    
    try {
      // Get all chats in this folder before deleting
      const folderChats = chats ? chats.filter(chat => chat.folderId === folderId) : [];
      
      // Optimistically update UI first - remove the folder from the list
      setLocalFolders(prev => prev.filter(folder => folder.id !== folderId));
      
      // Perform database operation to delete the folder (will also update the chats)
      const success = await deleteFolder(folderId);
      
      if (!success) {
        // If operation failed, restore the folder in the UI
        debouncedFetchFolders();
      } else {
        setSelectedFolder(null);
        
        // Clear expanded state for this folder
        setExpandedFolders(prev => {
          const newState = { ...prev };
          delete newState[folderId];
          return newState;
        });
      }
    } catch (err) {
      console.error("Error deleting folder:", err);
      
      // If there was an error, restore correct state
      debouncedFetchFolders();
    }
  };
  
  // Handle folder context menu
  const handleFolderContextMenu = (folder: IChatFolder) => {
    setSelectedFolder(folder);
  };
  
  // Toggle folder expansion
  const toggleFolderExpansion = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };
  
  // Handle moving a chat to a folder
  const handleMoveToFolder = async (chatId: string, folderId: string | null) => {
    if (folderOperationInProgress) return; // Prevent multiple operations
    
    console.log("Moving chat", chatId, "to folder", folderId);
    const success = await assignChatToFolder(chatId, folderId);
    
    if (success) {
      // Use debounced fetch to update UI only on success
      debouncedFetchChat();
    }
  };
  
  // Group chats by folder
  const chatsByFolder = folders ? folders.reduce((acc: {[key: string]: IChat[]}, folder) => {
    acc[folder.id] = chats ? chats.filter(chat => chat.folderId === folder.id) : [];
    return acc;
  }, {}) : {};
  
  // Get ungrouped chats (not in any folder)
  const ungroupedChats = chats ? chats.filter(chat => !chat.folderId && chat.id !== tempChatId) : [];
  
  // Delete a specific chat
  const handleDeleteChat = async (chatId: string) => {
    if (chatId === currentChat?.id) {
      // If the current chat is being deleted, navigate to temp chat first
      navigate(`/chats/${tempChatId}`);
    }
    
    // Call API to delete the chat
    await window.electron.db.run(`DELETE FROM chats WHERE id = ?`, [chatId]);
    await window.electron.db.run(`DELETE FROM messages WHERE chatId = ?`, [chatId]);
    
    // Use debounced fetch
    debouncedFetchChat();
  };
  
  return (
    <div className={`h-full flex flex-col ${collapsed ? 'items-center' : ''}`}>
      {/* Folders section - let parent control height */}
      <div className={`folders-section flex-shrink-0 ${collapsed ? 'items-center' : ''}`}
           style={{
             overflowY: 'auto',
             overflowX: 'hidden',
             paddingBottom: '1px',
             paddingTop: '4px',
             scrollbarWidth: 'thin',
             scrollbarColor: 'rgba(var(--color-border), 0.4) transparent',
             minHeight: '20px'
           }}>
        {folders && folders.length > 0 ? (
          // Show all folders and make them scrollable
          folders.map(folder => (
            <FolderComponent 
              key={folder.id}
              folder={folder}
              chats={chatsByFolder[folder.id] || []}
              isExpanded={!!expandedFolders[folder.id]}
              onToggle={() => toggleFolderExpansion(folder.id)}
              onContextMenu={handleFolderContextMenu}
              onRenameFolder={openRenameDialog}
              onDeleteFolder={handleDeleteFolder}
              currentChatId={currentChat?.id || ''}
              folders={folders}
              onMoveToFolder={handleMoveToFolder}
              onDeleteChat={handleDeleteChat}
              collapsed={collapsed}
            />
          ))
        ) : (
          // Always show this message if folders are empty
          <div className={`text-xs text-center px-4 py-3 ${collapsed ? 'w-12' : ''} text-gray-400 dark:text-gray-500 italic opacity-70`}>
            {collapsed ? 
              <Tooltip content={t('Chat.NoFoldersYet')} relationship="label" positioning="after">
                <span>...</span> 
              </Tooltip> : 
              t('Chat.NoFoldersYet')
            }
          </div>
        )}
      </div>
      
      {/* Spacer/Divider logic remains */}
      
      {/* Ungrouped chats section - let parent control height */}
      <div className={`ungrouped-chats-section flex-1 overflow-y-auto chat-list-container ${collapsed ? 'items-center' : ''}`}
           style={{ 
             paddingBottom: '10px',
             paddingTop: '0px',
             overflowY: 'auto',
             overflowX: 'hidden',
             scrollbarWidth: 'thin',
             scrollbarColor: 'rgba(var(--color-border), 0.4) transparent',
             minHeight: 0 // Ensure it can shrink
           }}>
        {ungroupedChats.length > 0 && (
          <UngroupedArea 
            chats={ungroupedChats}
            currentChatId={currentChat?.id || ''}
            folders={folders || []}
            onMoveToFolder={handleMoveToFolder}
            onDeleteChat={handleDeleteChat}
            collapsed={collapsed}
          />
        )}
      </div>
      
      {/* Add global style for scrollbars */}
      <style>{`
        /* Ultra-minimal line scrollbar */
        .folders-section::-webkit-scrollbar,
        .ungrouped-chats-section::-webkit-scrollbar {
          width: 1px;
          height: 0;
        }
        
        /* Hide horizontal scrollbars */
        .folders-section::-webkit-scrollbar:horizontal,
        .ungrouped-chats-section::-webkit-scrollbar:horizontal {
          display: none;
        }
        
        /* Invisible track */
        .folders-section::-webkit-scrollbar-track,
        .ungrouped-chats-section::-webkit-scrollbar-track {
          background: transparent;
        }
        
        /* Just a thin line */
        .folders-section::-webkit-scrollbar-thumb,
        .ungrouped-chats-section::-webkit-scrollbar-thumb {
          background-color: rgba(var(--color-border), 0.1);
          border-radius: 0;
          transition: all 0.2s ease;
        }
        
        /* Slightly more visible on hover */
        .folders-section:hover::-webkit-scrollbar-thumb,
        .ungrouped-chats-section:hover::-webkit-scrollbar-thumb {
          background-color: rgba(var(--color-border), 0.2);
        }
        
        /* Slightly blue when active */
        .folders-section::-webkit-scrollbar-thumb:active,
        .ungrouped-chats-section::-webkit-scrollbar-thumb:active {
          background-color: rgba(59, 130, 246, 0.3);
        }
        
        /* Hide all scrollbar buttons */
        .folders-section::-webkit-scrollbar-button,
        .ungrouped-chats-section::-webkit-scrollbar-button {
          display: none;
        }
        
        /* Firefox - ultra-minimal */
        .folders-section,
        .ungrouped-chats-section {
          scrollbar-width: thin;
          scrollbar-color: rgba(var(--color-border), 0.1) transparent;
          overflow-x: hidden;
        }
        
        /* Firefox hover effect */
        .folders-section:hover,
        .ungrouped-chats-section:hover {
          scrollbar-color: rgba(var(--color-border), 0.2) transparent;
        }
        
        /* Hide scrollbar in IE/Edge */
        .folders-section, 
        .ungrouped-chats-section {
          -ms-overflow-style: none;
          overflow-x: hidden;
        }
      `}</style>
      
      {/* Create Folder Dialog */}
      <Dialog 
        open={isCreateFolderDialogOpen}
        onOpenChange={(event, data) => {
          if (!data.open) {
            setFolderName(''); // Reset folder name when closing
          }
          setIsCreateFolderDialogOpen(data.open);
        }}
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
      
      {/* Rename Folder Dialog */}
      <Dialog 
        open={isRenameFolderDialogOpen}
        onOpenChange={(event, data) => {
          if (!data.open) {
            setFolderName(''); // Reset folder name when closing
          }
          setIsRenameFolderDialogOpen(data.open);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t('Chat.RenameFolder')}</DialogTitle>
            <DialogContent>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder={t('Chat.FolderNamePlaceholder')}
              />
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsRenameFolderDialogOpen(false)}>
                {t('Common.Cancel')}
              </Button>
              <Button appearance="primary" onClick={handleRenameFolder}>
                {t('Common.Rename')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      
      {/* Folder Context Menu */}
      {selectedFolder && (
        <Menu>
          <MenuTrigger>
            <div className="context-menu-trigger" onContextMenu={(e) => e.preventDefault()}>
              {/* This is a hidden trigger */}
            </div>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem 
                icon={<Edit20Regular />}
                onClick={() => {
                  openRenameDialog(selectedFolder);
                  setSelectedFolder(null);
                }}
              >
                {t('Common.Rename')}
              </MenuItem>
              <MenuItem 
                icon={<Delete20Regular />}
                onClick={() => {
                  handleDeleteFolder(selectedFolder.id);
                }}
              >
                {t('Common.Delete')}
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      )}
    </div>
  );
}
