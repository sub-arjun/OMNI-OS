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
  OptionsFilled,
  OptionsRegular,
  ArrowDownload24Regular,
} from '@fluentui/react-icons';
import ConfirmDialog from 'renderer/components/ConfirmDialog';
import ExportPromptDialog from 'renderer/components/ExportPromptDialog';
import useNav from 'hooks/useNav';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IPromptDef } from '../../../intellichat/types';
import { fmtDateTime, unix2date, highlight, date2unix } from 'utils/util';
import usePromptStore from 'stores/usePromptStore';
import useToast from 'hooks/useToast';

const EditIcon = bundleIcon(EditFilled, EditRegular);
const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);
const PinIcon = bundleIcon(PinFilled, PinRegular);
const PinOffIcon = bundleIcon(PinOffFilled, PinOffRegular);

const OptionsIcon = bundleIcon(OptionsFilled, OptionsRegular);

export default function Grid({
  prompts,
  keyword = '',
}: {
  prompts: IPromptDef[];
  keyword: string;
}) {
  const { t } = useTranslation();
  const [delConfirmDialogOpen, setDelConfirmDialogOpen] =
    useState<boolean>(false);
  const [exportDialogOpen, setExportDialogOpen] = useState<boolean>(false);
  const [exportJsonData, setExportJsonData] = useState<string>('');
  const [innerHeight, setInnerHeight] = useState(window.innerHeight);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const deletePrompt = usePromptStore((state) => state.deletePrompt);
  const updatePrompt = usePromptStore((state) => state.updatePrompt);
  const { notifySuccess, notifyError } = useToast();
  const navigate = useNav();
  const pinPrompt = (id: string) => {
    updatePrompt({ id, pinedAt: date2unix(new Date()) });
  };
  const unpinPrompt = (id: string) => {
    updatePrompt({ id, pinedAt: null });
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
      prompts.map((prompt) => {
        const models = prompt.models || [];
        return {
          id: prompt.id,
          name: { value: prompt.name },
          models: {
            value:
              models.length > 2
                ? models.slice(0, 2).concat(`and ${models.length - 2} more...`)
                : models,
          },
          updatedAt: {
            value: fmtDateTime(unix2date(prompt.updatedAt as number)),
            timestamp: prompt.updatedAt,
          },
          pined: !!prompt.pinedAt,
        };
      }),
    [prompts]
  );

  type NameCell = {
    value: string;
  };
  type ModelsCell = {
    value: string[];
  };
  type UpdatedCell = {
    value: string;
    timestamp: number;
  };
  type Item = {
    id: string;
    name: NameCell;
    models: ModelsCell;
    updatedAt: UpdatedCell;
    pined: boolean;
  };

  const columns: TableColumnDefinition<Item>[] = [
    createTableColumn<Item>({
      columnId: 'name',
      compare: (a: Item, b: Item) => {
        return a.name.value.localeCompare(b.name.value);
      },
      renderHeaderCell: () => {
        return t('Common.Name');
      },
      renderCell: (item) => {
        return (
          <TableCell>
            <TableCellLayout truncate>
              <div className="flex flex-start items-center">
                <div
                  dangerouslySetInnerHTML={{
                    __html: highlight(item.name.value, keyword),
                  }}
                />
                {item.pined ? <PinFilled className="ml-1" /> : null}
              </div>
            </TableCellLayout>
            <TableCellActions>
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button icon={<OptionsIcon />} appearance="subtle" />
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem
                      icon={<EditIcon />}
                      onClick={() => navigate(`/prompts/form/${item.id}`)}
                    >
                      {t('Common.Edit')}
                    </MenuItem>
                    <MenuItem
                      icon={<DeleteIcon />}
                      onClick={() => {
                        setActivePromptId(item.id);
                        setDelConfirmDialogOpen(true);
                      }}
                    >
                      {t('Common.Delete')}{' '}
                    </MenuItem>
                    <MenuItem
                      icon={<ArrowDownload24Regular />}
                      onClick={async () => {
                        const promptToExport = prompts.find(p => p.id === item.id);
                        if (!promptToExport) return;

                        try {
                          // First fetch the complete prompt data to ensure we get all fields
                          const getPrompt = usePromptStore.getState().getPrompt;
                          const fullPromptData = await getPrompt(promptToExport.id);
                          
                          // Print original prompt object to debug
                          console.log('Original prompt object from grid:', JSON.stringify(promptToExport, null, 2));
                          console.log('Full prompt data from store:', JSON.stringify(fullPromptData, null, 2));
                          
                          // Create a complete exported version of the prompt with all necessary fields
                          const exportData = {
                            // Required fields
                            name: fullPromptData.name,
                            
                            // IMPORTANT: Content fields with explicit access and safety defaults
                            systemMessage: fullPromptData.systemMessage ?? "",
                            userMessage: fullPromptData.userMessage ?? "",
                            
                            // Configuration fields with proper type handling
                            maxTokens: typeof fullPromptData.maxTokens === 'number' ? fullPromptData.maxTokens : null,
                            temperature: typeof fullPromptData.temperature === 'number' ? fullPromptData.temperature : null,
                            
                            // Array fields with proper type handling
                            systemVariables: Array.isArray(fullPromptData.systemVariables) ? 
                              [...fullPromptData.systemVariables] : [],
                            userVariables: Array.isArray(fullPromptData.userVariables) ? 
                              [...fullPromptData.userVariables] : [],
                            models: Array.isArray(fullPromptData.models) ? 
                              [...fullPromptData.models] : []
                          };
                          
                          // Verify system prompt and user message are properly loaded
                          console.log('System message content:', exportData.systemMessage);
                          console.log('User message content:', exportData.userMessage);
                          
                          // Log to console for comprehensive debugging
                          console.log('Exporting prompt:', {
                            name: exportData.name,
                            systemMessage: `${exportData.systemMessage.length} chars`,
                            userMessage: `${exportData.userMessage.length} chars`,
                            maxTokens: exportData.maxTokens,
                            temperature: exportData.temperature,
                            systemVariables: exportData.systemVariables.length + ' items',
                            userVariables: exportData.userVariables.length + ' items',
                            models: exportData.models.length + ' models'
                          });

                          // Format the JSON with pretty printing
                          const json = JSON.stringify(exportData, null, 2);
                          
                          // Debug the final JSON to ensure all fields are present
                          console.log('Final JSON to be displayed:', json);
                          console.log('systemMessage length in JSON:', (exportData.systemMessage || '').length);
                          console.log('userMessage length in JSON:', (exportData.userMessage || '').length);
                          
                          // Store the JSON and show the dialog
                          setExportJsonData(json);
                          setExportDialogOpen(true);
                          notifySuccess(t('Common.ExportSuccess'));
                        } catch (error) {
                          console.error('Export error:', error);
                          notifyError(t('Common.ExportFailed'));
                        }
                      }}
                    >
                      {t('Common.Export')}{' '}
                    </MenuItem>
                    {item.pined ? (
                      <MenuItem
                        icon={<PinOffIcon />}
                        onClick={() => unpinPrompt(item.id)}
                      >
                        {t('Common.Unpin')}{' '}
                      </MenuItem>
                    ) : (
                      <MenuItem
                        icon={<PinIcon />}
                        onClick={() => pinPrompt(item.id)}
                      >
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
      columnId: 'models',
      compare: (a, b) => {
        return a.models.value.join(',').localeCompare(b.models.value.join(','));
      },
      renderHeaderCell: () => {
        return t('Prompt.Form.ApplicableModels');
      },
      renderCell: (item) => {
        return (
          <TableCellLayout truncate>
            <span className="latin">{item.models.value.join(', ')}</span>
          </TableCellLayout>
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
        onConfirm={() => {
          deletePrompt(activePromptId as string);
          setActivePromptId(null);
          notifySuccess(t('Prompt.Notification.Deleted'));
        }}
      />
      <ExportPromptDialog
        open={exportDialogOpen}
        setOpen={setExportDialogOpen}
        jsonData={exportJsonData}
      />
    </div>
  );
}
