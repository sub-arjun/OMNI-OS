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
} from '@fluentui/react-icons';
import ConfirmDialog from 'renderer/components/ConfirmDialog';
import useNav from 'hooks/useNav';
import { useEffect, useMemo, useState } from 'react';
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
          collection.updatedAt = {
            value: fmtDateTime(unix2date(collection.updatedAt as number)),
            timestamp: collection.updatedAt,
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
              <div className="flex flex-start items-center gap-1">
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
                    />
                  </Tooltip>
                )}
                {item.pinedAt ? <PinFilled className="ml-1" /> : null}
              </div>
            </TableCellLayout>
            <TableCellActions>
              <Tooltip content={t('Knowledge.Action.ManageFiles')} relationship="label">
                <Button 
                  icon={<DocumentFolderIcon />} 
                  appearance="subtle"
                  onClick={() => {
                    setActiveCollection(item);
                    setFileDrawerOpen(true);
                  }}
                />
              </Tooltip>
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button icon={<MoreHorizontalIcon />} appearance="subtle" />
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem
                      icon={<EditIcon />}
                      onClick={() =>
                        navigate(`/knowledge/collection-form/${item.id}`)
                      }
                    >
                      {t('Common.Edit')}
                    </MenuItem>
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
          <TableCellLayout>
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
        return (
          <TableCellLayout>
            <span className="latin">{item.numOfFiles}</span>
          </TableCellLayout>
        );
      },
    }),
  ];

  const renderRow: RowRenderer<Item> = ({ item, rowId }, style) => (
    <DataGridRow<Item> key={rowId} style={style}>
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
