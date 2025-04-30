import {
  Button,
  Menu,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MenuItem,
  Tooltip,
  Checkbox,
  MenuDivider,
  MenuGroupHeader,
  Text,
} from '@fluentui/react-components';
import {
  bundleIcon,
  Wand20Filled,
  Wand20Regular,
  Info16Regular,
} from '@fluentui/react-icons';
import { IChat, IChatContext } from 'intellichat/types';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Mousetrap from 'mousetrap';
import useToast from 'hooks/useToast';
import useAppearanceStore from 'stores/useAppearanceStore';
import { MCP_SERVER_STATE_CHANGED } from 'consts';
import ClickAwayListener from 'renderer/components/ClickAwayListener';
import type { MenuCheckedValueChangeEvent, MenuCheckedValueChangeData } from '@fluentui/react-components';

const ToolIcon = bundleIcon(Wand20Filled, Wand20Regular);

interface ServerWithState {
  key: string;
  name: string;
  isActive: boolean;
}

export default function ToolCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  // All hooks must be called in the same order on every render
  const { t } = useTranslation();
  const theme = useAppearanceStore((state) => state.theme);
  const { notifySuccess, notifyError } = useToast();
  const [servers, setServers] = useState<ServerWithState[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  
  // Use refs instead of state to avoid React queue errors
  const menuOpenRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  // Define all callbacks with useCallback at the top level
  const handleMenuOpenChange = useCallback((e: any, data: { open: boolean }) => {
    menuOpenRef.current = data.open;
  }, []);

  // Function to dispatch a global MCP state change event
  const dispatchMCPStateChangeEvent = useCallback((serverKey: string, isActive: boolean) => {
    // Create a custom event that other components can listen for
    const event = new CustomEvent('mcp-server-state-changed', { 
      detail: { 
        serverKey, 
        isActive, 
        source: 'toolctrl',
        timestamp: Date.now() 
      }
    });
    
    // Dispatch the event
    window.dispatchEvent(event);
    
    // Also dispatch it again after a small delay to catch any race conditions
    setTimeout(() => {
      const delayedEvent = new CustomEvent('mcp-server-state-changed', { 
        detail: { 
          serverKey, 
          isActive, 
          source: 'toolctrl-delayed',
          timestamp: Date.now() 
        }
      });
      window.dispatchEvent(delayedEvent);
    }, 200);
  }, []);

  // Fetch MCP servers - simplified to reduce potential errors
  const fetchServers = useCallback(async () => {
    try {
      const mcpConfig = await window.electron?.mcp?.getConfig();
      if (mcpConfig && mcpConfig.servers) {
        const formattedServers = mcpConfig.servers.map((server: any) => ({
          key: server.key,
          name: server.name || server.key,
          isActive: server.isActive
        }));
        setServers(formattedServers);
      } else {
        setServers([]);
      }
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
      setServers([]);
    }
  }, []);

  // Function to make sure the menu stays open
  const keepMenuOpen = useCallback((e: React.SyntheticEvent) => {
    // Prevent default behavior and stop propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Ensure the menu stays open
    if (!menuOpenRef.current) {
      menuTriggerRef.current?.click();
    }
  }, []);

  // Update toggleServer to ensure menu stays open
  const toggleServer = useCallback(async (serverKey: string, activate: boolean, e: React.SyntheticEvent) => {
    // Keep menu open
    keepMenuOpen(e);
    
    // Set loading immediately
    setLoading(true);
    
    try {
      // Dispatch global event immediately to notify other components about the state change
      if (activate) {
        dispatchMCPStateChangeEvent(serverKey, activate);
      }
      
      // Call the appropriate API based on whether we're activating or deactivating
      if (activate) {
        await window.electron?.mcp?.activate({ key: serverKey });
      } else {
        await window.electron?.mcp?.deactivated(serverKey);
        // For deactivation, dispatch event after the operation as it was working correctly
        dispatchMCPStateChangeEvent(serverKey, activate);
      }
      
      // Get the current config to explicitly update the server state
      const mcpConfig = await window.electron?.mcp?.getConfig();
      if (mcpConfig && mcpConfig.servers) {
        // Create a new config object with the updated server state
        const updatedConfig = {
          ...mcpConfig,
          servers: mcpConfig.servers.map((server: any) => 
            server.key === serverKey 
              ? { ...server, isActive: activate } 
              : server
          )
        };
        
        // Save the updated config back to disk
        await window.electron?.mcp?.putConfig(updatedConfig);
        
        // Show success notification
        notifySuccess(`${serverKey} ${activate ? t('Common.Activated') : t('Common.Deactivated')}`);
        
        // Reload servers to reflect changes
        await fetchServers();
        
        // Add a slight delay before completing to ensure the change propagates fully
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Do one final refresh to ensure UI is in sync
        await fetchServers();
        
        // Ensure menu is still open after all operations complete
        setTimeout(() => {
          if (!menuOpenRef.current && menuTriggerRef.current) {
            menuTriggerRef.current.click();
          }
        }, 50);
      }
    } catch (error) {
      console.error('Error toggling server:', error);
      notifyError(`${t('Common.Error')} ${activate ? t('Common.Activating') : t('Common.Deactivating')} ${serverKey}`);
    } finally {
      setLoading(false);
    }
  }, [fetchServers, notifySuccess, notifyError, t, dispatchMCPStateChangeEvent, keepMenuOpen]);

  // Handle MCP state change events from other components
  const handleMCPStateChange = useCallback((event: CustomEvent) => {
    const { serverKey, isActive, source } = event.detail;
    
    // Only update if the event came from a different component (Grid)
    if (source && (source === 'grid' || source === 'grid-delayed')) {
      // Mark as loading
      setLoading(true);
      
      // Immediately update the UI
      fetchServers().then(() => {
        // Force a second fetch after a small delay to ensure we have the latest data
        setTimeout(() => {
          fetchServers().then(() => {
            setLoading(false);
          });
        }, 300);
      });
    }
  }, [fetchServers]);

  // Load servers on component mount
  useEffect(() => {
    let isComponentMounted = true;
    
    // Initial load of servers
    fetchServers();
    
    // Set up keyboard shortcut
    Mousetrap.bind(['shift+alt+t'], () => {
      // Find and click the tools button directly using DOM
      const toolButton = document.querySelector('.tool-ctrl-button');
      if (toolButton && toolButton instanceof HTMLElement) {
        toolButton.click();
      } else if (menuTriggerRef.current) {
        menuTriggerRef.current.click();
      }
      return false;
    });
    
    // Set up polling to keep in sync with tools page, but less frequently since we have events
    const syncInterval = setInterval(() => {
      if (isComponentMounted && !loading && !menuOpenRef.current) {
        fetchServers();
      }
    }, 3000); // Poll less frequently since we have event-based updates
    
    // Listen for MCP state change events from other components
    window.addEventListener(MCP_SERVER_STATE_CHANGED, handleMCPStateChange as unknown as EventListener);
    
    // Cleanup function
    return () => {
      isComponentMounted = false;
      Mousetrap.unbind(['shift+alt+t']);
      clearInterval(syncInterval);
      window.removeEventListener(MCP_SERVER_STATE_CHANGED, handleMCPStateChange as unknown as EventListener);
    };
  }, [fetchServers, loading, handleMCPStateChange]);

  // Calculate this outside of the render function to avoid inconsistency
  const activeServerCount = servers.filter(server => server.isActive).length;

  const handleClickAway = () => {
    setOpen(false);
  };

  const onCheckedValueChange = (
    e: MenuCheckedValueChangeEvent,
    data: MenuCheckedValueChangeData
  ) => {
    setActiveTools(data.checkedItems);
  };

  const toggleDialog = () => {
    setOpen(!open);
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway} active={open}>
      <Menu
        open={open}
        onCheckedValueChange={onCheckedValueChange}
        checkedValues={{ tool: activeTools }}
      >
        <MenuTrigger disableButtonEnhancement>
          <Tooltip
            content={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Tools')}</div>
                <div>Enable/disable tools for the AI to use (Shift+Alt+T)</div>
              </div>
            }
            relationship="description"
            positioning="above"
          >
            <Button
              size="small"
              aria-label={t('Common.Tools')}
              appearance="subtle"
              icon={<ToolIcon className="mr-0" />}
              onClick={toggleDialog}
              className="justify-start text-color-secondary tool-ctrl-button"
              style={{ 
                borderColor: 'transparent', 
                boxShadow: 'none', 
                paddingLeft: 1, 
                paddingRight: activeServerCount > 0 ? 4 : 1, // More padding if number is shown
                minWidth: 'auto' // Allow button to shrink
              }}
            >
              {/* Conditionally render the number directly in the button */}
              {activeServerCount > 0 && (
                <span style={{ marginLeft: '2px', fontSize: '12px' }}>{activeServerCount}</span>
              )}
            </Button>
          </Tooltip>
        </MenuTrigger>
        
        <MenuPopover>
          <MenuList>
            {loading ? (
              <MenuItem disabled>
                <span>{t('Common.Loading')}...</span>
              </MenuItem>
            ) : (
              <>
                {/* Tools information */}
                <MenuItem disabled>
                  <div className="flex items-center text-xs text-gray-500 py-1">
                    <Info16Regular className="mr-1 flex-shrink-0" />
                    <Text>{t('Tools.PrerequisiteDescription')}</Text>
                  </div>
                </MenuItem>
                <MenuDivider />
                
                {/* Show servers with toggles */}
                {servers.length > 0 ? (
                  <>
                    <MenuGroupHeader>
                      <div className="flex items-center">
                        <ToolIcon className="mr-2" />
                        {t('Common.Tools')}
                      </div>
                    </MenuGroupHeader>
                    {servers.map(server => (
                      <MenuItem 
                        key={server.key}
                        className="flex items-center justify-between"
                        onClick={keepMenuOpen}
                      >
                        <div 
                          className="flex flex-1 items-center w-full" 
                          onClick={keepMenuOpen}
                        >
                          <Checkbox
                            checked={server.isActive}
                            onChange={(e) => {
                              keepMenuOpen(e);
                              toggleServer(server.key, !server.isActive, e);
                            }}
                            className="mr-2"
                          />
                          <span>{server.name}</span>
                        </div>
                      </MenuItem>
                    ))}
                  </>
                ) : (
                  <MenuItem disabled>
                    <span className="text-gray-500">{t('Common.NoActiveServers')}</span>
                  </MenuItem>
                )}
              </>
            )}
          </MenuList>
        </MenuPopover>
      </Menu>
    </ClickAwayListener>
  );
} 