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
  PinFilled,
  PinRegular,
  PinOffFilled,
  PinOffRegular,
  DeleteFilled,
  DeleteRegular,
  EditFilled,
  EditRegular,
  DocumentFolderRegular,
  DocumentFolderFilled,
  Info16Regular,
  MoreHorizontalFilled,
  MoreHorizontalRegular,
  CloudFilled,
  CloudRegular,
} from '@fluentui/react-icons';
import ConfirmDialog from 'renderer/components/ConfirmDialog';
import useNav from 'hooks/useNav';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDateTime, unix2date, date2unix } from 'utils/util';
import useToast from 'hooks/useToast';
import FileDrawer from './FileDrawer';
import useKnowledgeStore from 'stores/useKnowledgeStore';

const EditIcon = bundleIcon(EditFilled, EditRegular);
const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);
const PinIcon = bundleIcon(PinFilled, PinRegular);
const PinOffIcon = bundleIcon(PinOffFilled, PinOffRegular);
const DocumentFolderIcon = bundleIcon(
  DocumentFolderFilled,
  DocumentFolderRegular,
);
const CloudIcon = bundleIcon(CloudFilled, CloudRegular);
const MoreHorizontalIcon = bundleIcon(
  MoreHorizontalFilled,
  MoreHorizontalRegular,
);

export default function Grid({ collections }: { collections: any[] }) {
  const { t } = useTranslation();
  const [delConfirmDialogOpen, setDelConfirmDialogOpen] =
    useState<boolean>(false);
  const [activeCollection, setActiveCollection] = useState<any>(null);
  const [fileDrawerOpen, setFileDrawerOpen] = useState<boolean>(false);
  const { updateCollection, deleteCollection } = useKnowledgeStore();
  const [innerHeight, setInnerHeight] = useState(window.innerHeight);
  const { notifySuccess } = useToast();
  const navigate = useNav();
  const pin = (id: string) => {
    updateCollection({ id, pinedAt: date2unix(new Date()) });
  };
  const unpin = (id: string) => {
    updateCollection({ id, pinedAt: null });
  };

  // Helper to check if a collection is an OMNIBase collection
  const isOmnibaseCollection = (collection: any) => {
    return collection.type === 'omnibase' || (collection.id && collection.id.startsWith('omnibase:'));
  };

  useEffect(() => {
    const handleResize = () => {
      setInnerHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const items = useMemo(
    () =>
      collections
        .map((collection) => {
          const updatedAtTimestamp = typeof collection.updatedAt === 'number' && !isNaN(collection.updatedAt) 
            ? collection.updatedAt 
            : date2unix(new Date());
          
          collection.updatedAt = {
            value: fmtDateTime(unix2date(updatedAtTimestamp)),
            timestamp: updatedAtTimestamp,
          };
          return collection;
        })
        .sort((a, b) => {
          if (a.pinedAt && b.pinedAt) {
            return b.pinedAt - a.pinedAt;
          }
          if (a.pinedAt) {
            return -1;
          }
          if (b.pinedAt) {
            return 1;
          }
          return b.id.localeCompare(a.id);
        }),
    [collections],
  );

  type UpdatedCell = {
    value: string;
    timestamp: number;
  };
  type Item = {
    id: string;
    name: string;
    memo: string;
    updatedAt: UpdatedCell;
    numOfFiles: number;
    pinedAt: number | null;
    type?: 'local' | 'omnibase';
    indexName?: string;
    namespace?: string;
  };

  const columns: TableColumnDefinition<Item>[] = [
    createTableColumn<Item>({
      columnId: 'name',
      compare: (a: Item, b: Item) => {
        return a.name.localeCompare(b.name);
      },
      renderHeaderCell: () => {
        return t('Common.Name');
      },
      renderCell: (item) => {
        return (
          <TableCell>
            <TableCellLayout truncate>
              <div 
                className={`flex flex-start items-center gap-1 ${!isOmnibaseCollection(item) ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (!isOmnibaseCollection(item)) {
                    setActiveCollection(item);
                    setFileDrawerOpen(true);
                  }
                }}
              >
                {isOmnibaseCollection(item) && <CloudIcon className="text-blue-500" />}
                <div className="-mt-0.5">{item.name}</div>
                {item.memo && (
                  <Tooltip
                    content={item.memo}
                    relationship="label"
                    withArrow
                    appearance="inverted"
                  >
                    <Button
                      icon={<Info16Regular />}
                      size="small"
                      appearance="subtle"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Tooltip>
                )}
                {item.pinedAt ? <PinFilled className="ml-1" /> : null}
              </div>
            </TableCellLayout>
            <TableCellActions>
              {!isOmnibaseCollection(item) && (
                <Tooltip content={t('Knowledge.Action.ManageFiles')} relationship="label">
                  <Button 
                    icon={<DocumentFolderIcon />} 
                    appearance="subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCollection(item);
                      setFileDrawerOpen(true);
                    }}
                  />
                </Tooltip>
              )}
              {isOmnibaseCollection(item) && (
                <Tooltip content={t('Knowledge.OmniBaseInfo')} relationship="label">
                  <Button 
                    icon={<CloudIcon />} 
                    appearance="subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      notifySuccess(
                        `${t('Knowledge.OmniBaseDetails')}: ${item.indexName}${item.namespace ? ` (${t('Knowledge.Namespace')}: ${item.namespace})` : ''}`
                      );
                    }}
                  />
                </Tooltip>
              )}
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button 
                    icon={<MoreHorizontalIcon />} 
                    appearance="subtle"
                    onClick={(e) => e.stopPropagation()}
                  />
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    {!isOmnibaseCollection(item) && (
                      <MenuItem
                        icon={<EditIcon />}
                        onClick={() =>
                          navigate(`/knowledge/collection-form/${item.id}`)
                        }
                      >
                        {t('Common.Edit')}
                      </MenuItem>
                    )}
                    <MenuItem
                      icon={<DeleteIcon />}
                      onClick={() => {
                        setActiveCollection(item);
                        setDelConfirmDialogOpen(true);
                      }}
                    >
                      {t('Common.Delete')}{' '}
                    </MenuItem>
                    {item.pinedAt ? (
                      <MenuItem
                        icon={<PinOffIcon />}
                        onClick={() => unpin(item.id)}
                      >
                        {t('Common.Unpin')}{' '}
                      </MenuItem>
                    ) : (
                      <MenuItem icon={<PinIcon />} onClick={() => pin(item.id)}>
                        {t('Common.Pin')}{' '}
                      </MenuItem>
                    )}
                  </MenuList>
                </MenuPopover>
              </Menu>
            </TableCellActions>
          </TableCell>
        );
      },
    }),
    createTableColumn<Item>({
      columnId: 'updatedAt',
      compare: (a, b) => {
        return a.updatedAt.value.localeCompare(b.updatedAt.value);
      },
      renderHeaderCell: () => {
        return t('Common.LastUpdated');
      },
      renderCell: (item) => {
        return (
          <TableCellLayout
            className={!isOmnibaseCollection(item) ? 'cursor-pointer' : ''}
            onClick={() => {
              if (!isOmnibaseCollection(item)) {
                setActiveCollection(item);
                setFileDrawerOpen(true);
              }
            }}
          >
            <span className="latin">{item.updatedAt.value}</span>
          </TableCellLayout>
        );
      },
    }),
    createTableColumn<Item>({
      columnId: 'numOfFiles',
      compare: (a, b) => {
        return b.numOfFiles - a.numOfFiles;
      },
      renderHeaderCell: () => {
        return t('Common.NumberOfFiles');
      },
      renderCell: (item) => {
        if (isOmnibaseCollection(item)) {
          return (
            <TableCellLayout>
              <div className="flex items-center gap-1">
                <CloudIcon className="text-blue-500" />
                <span className="text-xs text-gray-500">{t('Knowledge.OmniBase')}</span>
              </div>
            </TableCellLayout>
          );
        }
        
        return (
          <TableCellLayout
            className="cursor-pointer"
            onClick={() => {
              setActiveCollection(item);
              setFileDrawerOpen(true);
            }}
          >
            <span className="latin">{item.numOfFiles}</span>
          </TableCellLayout>
        );
      },
    }),
  ];

  const renderRow: RowRenderer<Item> = ({ item, rowId }, style) => (
    <DataGridRow<Item> 
      key={rowId} 
      style={{ 
        ...style, 
        cursor: !isOmnibaseCollection(item) ? 'pointer' : 'default' 
      }}
      onClick={(e: React.MouseEvent) => {
        // Only open file drawer if:
        // 1. It's not an OmniBase collection
        // 2. The click wasn't on an interactive element
        const target = e.target as HTMLElement;
        const isInteractive = target.closest('button, [role="button"], [role="menuitem"]');
        if (!isInteractive && !isOmnibaseCollection(item)) {
          setActiveCollection(item);
          setFileDrawerOpen(true);
        }
      }}
    >
      {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
    </DataGridRow>
  );
  const { targetDocument } = useFluent();
  const scrollbarWidth = useScrollbarWidth({ targetDocument });

  return (
    <div className="w-full">
      <DataGrid
        items={items}
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
        <DataGridBody<Item> itemSize={50} height={innerHeight - 155}>
          {renderRow}
        </DataGridBody>
      </DataGrid>
      <ConfirmDialog
        open={delConfirmDialogOpen}
        setOpen={setDelConfirmDialogOpen}
        message={t('Knowledge.Confirmation.DeleteCollection')}
        onConfirm={async () => {
          await deleteCollection(activeCollection.id);
          setActiveCollection(null);
          notifySuccess(t('Knowledge.Notification.CollectionDeleted'));
        }}
      />
      <FileDrawer
        collection={activeCollection || {}}
        open={fileDrawerOpen}
        setOpen={(open: boolean) => setFileDrawerOpen(open)}
      />
    </div>
  );
}
