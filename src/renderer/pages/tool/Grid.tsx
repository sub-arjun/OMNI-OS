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
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useMCPStore from 'stores/useMCPStore';
import useToast from 'hooks/useToast';
import { IMCPServer } from 'types/mcp';

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
}: {
  servers: IMCPServer[];
  onEdit: (server: IMCPServer) => void;
  onDelete: (server: IMCPServer) => void;
  onInspect: (server: IMCPServer) => void;
}) {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const { activateServer, deactivateServer } = useMCPStore((state) => state);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const [innerHeight, setInnerHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setInnerHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const columns: TableColumnDefinition<IMCPServer>[] = [
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
                {loading[item.key] ? (
                  <CircleHintHalfVertical16Filled className="animate-spin -mb-1" />
                ) : item.isActive ? (
                  <Circle16Filled className="text-green-500 -mb-0.5" />
                ) : (
                  <CircleOff16Regular className="text-gray-400 dark:text-gray-600 -mb-0.5" />
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
                disabled={loading[item.key]}
                checked={item.isActive}
                aria-label={t('Common.State')}
                onChange={async (ev: any, data: any) => {
                  if (data.checked) {
                    try {
                      setLoading((prev) => ({ ...prev, [item.key]: true }));
                      await activateServer(item.key);
                    } catch (error: any) {
                      notifyError(
                        error.message || t('MCP.ServerActivationFailed'),
                      );
                    } finally {
                      setLoading((prev) => ({ ...prev, [item.key]: false }));
                    }
                  } else {
                    deactivateServer(item.key);
                  }
                }}
              />
            </TableCellActions>
          </TableCell>
        );
      },
    }),
  ];

  const renderRow: RowRenderer<IMCPServer> = ({ item, rowId }, style) => (
    <DataGridRow<IMCPServer> key={rowId} style={style}>
      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
    </DataGridRow>
  );
  const { targetDocument } = useFluent();
  const scrollbarWidth = useScrollbarWidth({ targetDocument });

  return (
    <div className="w-full pr-4">
      <DataGrid
        items={servers}
        columns={columns}
        focusMode="cell"
        sortable
        size="small"
        className="w-full"
        getRowId={(item) => item.id}
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
