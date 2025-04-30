/* eslint-disable react/no-danger */
import {
  DataGridBody,
  DataGrid,
  DataGridRow,
  DataGridHeader,
  DataGridCell,
  DataGridHeaderCell,
  RowRenderer,
} from '@fluentui-contrib/react-data-grid-react-window';
import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Switch,
  TableCell,
  TableCellActions,
  TableCellLayout,
  TableColumnDefinition,
  Tooltip,
  createTableColumn,
  useFluent,
  useScrollbarWidth,
} from '@fluentui/react-components';
import {
  bundleIcon,
  Circle16Filled,
  CircleHintHalfVertical16Filled,
  CircleOff16Regular,
  Info16Regular,
  DeleteFilled,
  DeleteRegular,
  EditFilled,
  EditRegular,
  MoreHorizontalRegular,
  MoreHorizontalFilled,
  WrenchScrewdriver20Filled,
  WrenchScrewdriver20Regular,
} from '@fluentui/react-icons';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useMCPStore from 'stores/useMCPStore';
import useToast from 'hooks/useToast';
import { IMCPServer } from 'types/mcp';
import { MCP_SERVER_STATE_CHANGED } from '../../../consts';

const EditIcon = bundleIcon(EditFilled, EditRegular);
const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);
const WrenchScrewdriverIcon = bundleIcon(
  WrenchScrewdriver20Filled,
  WrenchScrewdriver20Regular,
);
const MoreHorizontalIcon = bundleIcon(
  MoreHorizontalFilled,
  MoreHorizontalRegular,
);

export default function Grid({
  servers,
  onEdit,
  onDelete,
  onInspect,
  loadingServers = {},
}: {
  servers: IMCPServer[];
  onEdit: (server: IMCPServer) => void;
  onDelete: (server: IMCPServer) => void;
  onInspect: (server: IMCPServer) => void;
  loadingServers?: Record<string, boolean>;
}) {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const { activateServer, deactivateServer, loadConfig } = useMCPStore((state) => state);
  const [localServers, setLocalServers] = useState<IMCPServer[]>(servers);
  
  // Update localServers when the props change
  useEffect(() => {
    setLocalServers(servers);
  }, [servers]);

  const [innerHeight, setInnerHeight] = useState(window.innerHeight);
  
  // Move all hooks to the top level to ensure consistent ordering
  const { targetDocument } = useFluent();
  // Always call useScrollbarWidth, even if targetDocument might be undefined
  const scrollbarWidth = useScrollbarWidth({ targetDocument });

  // Function to dispatch a global MCP state change event
  const dispatchMCPStateChangeEvent = useCallback((serverKey: string, isActive: boolean) => {
    // Create a custom event that other components can listen for
    const event = new CustomEvent(MCP_SERVER_STATE_CHANGED, { 
      detail: { 
        serverKey, 
        isActive, 
        source: 'grid',
        timestamp: Date.now() 
      }
    });
    window.dispatchEvent(event);
    
    // Dispatch a second time after a delay to catch race conditions
    setTimeout(() => {
      const delayedEvent = new CustomEvent(MCP_SERVER_STATE_CHANGED, { 
        detail: { 
          serverKey, 
          isActive, 
          source: 'grid-delayed',
          timestamp: Date.now() 
        }
      });
      window.dispatchEvent(delayedEvent);
    }, 200);
  }, []);
  
  // Listen for MCP state changes from ToolCtrl
  useEffect(() => {
    const handleMCPStateChange = async (event: CustomEvent) => {
      const { serverKey, isActive, source } = event.detail;
      
      // Only proceed if the event came from ToolCtrl to avoid loops
      if (source && (source.startsWith('toolctrl') || source === 'toolctrl-delayed')) {
        try {
          // Force reload of config data
          await loadConfig(true);
          
          // Update local server state to reflect changes immediately
          setLocalServers(prev => 
            prev.map(server => 
              server.key === serverKey ? { ...server, isActive } : server
            )
          );
          
          // Do another update after a delay to catch any race conditions
          setTimeout(async () => {
            await loadConfig(true);
            setLocalServers(servers); // Use the updated servers prop
          }, 250);
        } catch (error) {
          console.error('Error handling MCP state change:', error);
        }
      }
    };
    
    window.addEventListener(MCP_SERVER_STATE_CHANGED, handleMCPStateChange as unknown as EventListener);
    
    return () => {
      window.removeEventListener(MCP_SERVER_STATE_CHANGED, handleMCPStateChange as unknown as EventListener);
    };
  }, [loadConfig, servers]);

  useEffect(() => {
    const handleResize = () => {
      setInnerHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Define columns with memoization to prevent unnecessary recalculations
  const columns = useMemo<TableColumnDefinition<IMCPServer>[]>(() => [
    createTableColumn<IMCPServer>({
      columnId: 'name',
      compare: (a: IMCPServer, b: IMCPServer) => {
        return a.key.localeCompare(b.key);
      },
      renderHeaderCell: () => {
        return t('Common.Name');
      },
      renderCell: (item) => {
        return (
          <TableCell>
            <TableCellLayout truncate>
              <div className="flex flex-start items-center flex-grow overflow-y-hidden">
                {loadingServers[item.key] ? (
                  <CircleHintHalfVertical16Filled className="animate-spin -mb-1" />
                ) : item.isActive ? (
                  <Circle16Filled className="text-green-500 -mb-0.5" />
                ) : (
                  <CircleOff16Regular className="text-gray-400 dark:text-gray-400 -mb-0.5" />
                )}
                <div className="ml-1.5">
                  {item.key.includes('-') && 
                   item.key.split('-').length > 1 && 
                   !isNaN(Number(item.key.split('-').pop())) && 
                   !(item.name && item.name.match(/\(\d+\)$/)) ? (
                    <>
                      {item.name || item.key.split('-')[0]} <span className="text-xs text-gray-500">({Number(item.key.split('-').pop()) + 1})</span>
                    </>
                  ) : (
                    item.name || item.key
                  )}
                </div>
                {item.description && (
                  <div className="-mb-0.5">
                    <Tooltip
                      content={item.description}
                      relationship="label"
                      withArrow
                      appearance="inverted"
                    >
                      <Button
                        icon={<Info16Regular />}
                        size="small"
                        appearance="subtle"
                      />
                    </Tooltip>
                  </div>
                )}
                <div className="ml-4">
                  <Menu>
                    <MenuTrigger disableButtonEnhancement>
                      <Button
                        icon={<MoreHorizontalIcon />}
                        appearance="subtle"
                      />
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem
                          disabled={item.isActive}
                          icon={<EditIcon />}
                          onClick={() => onEdit(item)}
                        >
                          {t('Common.Edit')}
                        </MenuItem>
                        <MenuItem
                          disabled={item.isActive}
                          icon={<DeleteIcon />}
                          onClick={() => onDelete(item)}
                        >
                          {t('Common.Delete')}
                        </MenuItem>
                        <MenuItem
                          disabled={!item.isActive}
                          icon={<WrenchScrewdriverIcon />}
                          onClick={() => onInspect(item)}
                        >
                          {t('Common.Tools')}
                        </MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                </div>
              </div>
            </TableCellLayout>
            <TableCellActions>
              <Switch
                disabled={loadingServers[item.key]}
                checked={item.isActive}
                aria-label={t('Common.State')}
                onChange={async (ev: any, data: any) => {
                  if (data.checked) {
                    try {
                      // Dispatch event first to trigger loading state immediately
                      dispatchMCPStateChangeEvent(item.key, true);
                      
                      // Then activate the server
                      await activateServer(item.key);
                    } catch (error: any) {
                      notifyError(
                        error.message || t('MCP.ServerActivationFailed'),
                      );
                    }
                  } else {
                    // For deactivation, keep the current order as it's working correctly
                    await deactivateServer(item.key);
                    // Dispatch event to notify other components
                    dispatchMCPStateChangeEvent(item.key, false);
                  }
                }}
              />
            </TableCellActions>
          </TableCell>
        );
      },
    }),
  ], [t, loadingServers, onEdit, onDelete, onInspect, activateServer, deactivateServer, dispatchMCPStateChangeEvent, notifyError]);

  // Memoize renderRow function to avoid recreating on every render
  const renderRow = useMemo<RowRenderer<IMCPServer>>(() => 
    ({ item, rowId }, style) => (
      <DataGridRow<IMCPServer> key={rowId} style={style}>
        {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
      </DataGridRow>
    ), 
  []);

  return (
    <div className="w-full pr-4">
      <DataGrid
        items={localServers}
        columns={columns}
        focusMode="cell"
        sortable
        size="small"
        className="w-full"
        getRowId={(item) => item.id || item.key} // Use key as fallback if id doesn't exist
      >
        <DataGridHeader style={{ paddingRight: scrollbarWidth }}>
          <DataGridRow>
            {({ renderHeaderCell }) => (
              <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
            )}
          </DataGridRow>
        </DataGridHeader>
        <DataGridBody<IMCPServer> itemSize={50} height={innerHeight - 180}>
          {renderRow}
        </DataGridBody>
      </DataGrid>
    </div>
  );
}
