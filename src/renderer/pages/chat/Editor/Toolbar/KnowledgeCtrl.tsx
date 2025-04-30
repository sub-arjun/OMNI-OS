import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Combobox,
  Option,
  Divider,
  makeStyles,
  OptionOnSelectData,
  SelectionEvents,
  Tooltip,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Debug from 'debug';

import { IChat, IChatContext } from 'intellichat/types';
import {
  Library20Regular,
  Library20Filled,
  Dismiss24Regular,
  DismissCircle16Regular,
  bundleIcon,
  CloudFilled,
  CloudRegular,
} from '@fluentui/react-icons';
import { ICollection } from 'types/knowledge';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useChatKnowledgeStore from 'stores/useChatKnowledgeStore';
import React from 'react';
import ClickAwayListener from 'renderer/components/ClickAwayListener';

const debug = Debug('OMNI-OS:pages:chat:Editor:Toolbar:KnowledgeCtrl');

const KnowledgeIcon = bundleIcon(Library20Filled, Library20Regular);
const CloudIcon = bundleIcon(CloudFilled, CloudRegular);

// Maximum number of collections to render at once
const MAX_VISIBLE_OPTIONS = 50;

// Custom styles for the component - use this approach for Fluent UI's makeStyles
const useStyles = makeStyles({
  fixedHeightContainer: {
    height: '300px',
    display: 'flex',
    flexDirection: 'column',
  },
  comboboxContainer: {
    marginBottom: '10px',
  },
  dividerContainer: {
    margin: '5px 0',
  },
  selectedContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px',
  },
  collectionItem: {
    height: '34px',
    margin: '4px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--colorNeutralBackground1)',
  },
  statusMessage: {
    padding: '8px',
    textAlign: 'center',
    color: 'var(--colorNeutralForeground3)',
  }
});

// Helper function to check if a collection is an OMNIBase collection
function isOmnibaseCollection(collection: ICollection) {
  return collection.type === 'omnibase' || (collection.id && collection.id.startsWith('omnibase:'));
}

export default function KnowledgeCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  // Apply the styles within the component
  const styles = useStyles();
  const { t } = useTranslation();
  
  // Get store methods directly
  const { listCollections } = useKnowledgeStore();
  const { listChatCollections, setChatCollections } = useChatKnowledgeStore();
  
  // Simple state, always defined in the same order
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [collections, setCollections] = useState<ICollection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<ICollection[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Derived values (not state)
  const selectedIds = selectedCollections.map(c => c.id);
  
  // Filter collections based on search
  const filteredCollections = searchQuery.trim() 
    ? collections
        .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, MAX_VISIBLE_OPTIONS) 
    : collections.slice(0, MAX_VISIBLE_OPTIONS);
  
  // Load initial collections
  useEffect(() => {
    const loadSelectedCollections = async () => {
      try {
        const result = await listChatCollections(chat.id);
        setSelectedCollections(result || []);
      } catch (error) {
        debug('Error loading collections:', error);
        setSelectedCollections([]);
      }
    };
    
    loadSelectedCollections();
    
    // Setup keyboard shortcuts
    Mousetrap.bind('shift+alt+k', () => setIsDialogOpen(true));
    
    return () => {
      Mousetrap.unbind('shift+alt+k');
      Mousetrap.unbind('esc');
    };
  }, [chat.id, listChatCollections]);
  
  // Setup escape key when dialog is open
  useEffect(() => {
    if (isDialogOpen) {
      Mousetrap.bind('esc', () => setIsDialogOpen(false));
      
      // Load all collections when dialog opens
      listCollections()
        .then(setCollections)
        .catch(error => {
          debug('Error loading all collections:', error);
          setCollections([]);
        });
    } else {
      Mousetrap.unbind('esc');
      // Reset search when dialog closes
      setSearchQuery('');
    }
    
    return () => {
      Mousetrap.unbind('esc');
    };
  }, [isDialogOpen, listCollections]);
  
  // Simple function to select a collection with correct type signature
  const handleCollectionSelect = (_event: SelectionEvents, data: OptionOnSelectData) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    
    const newSelectedCollections = collections.filter(c => 
      data.selectedOptions.includes(c.id)
    );
    
    setSelectedCollections(newSelectedCollections);
    
    setChatCollections(chat.id, newSelectedCollections)
      .catch(error => {
        debug('Error updating collections:', error);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };
  
  // Simple function to remove a collection
  const handleCollectionRemove = (collection: ICollection) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    
    const newSelectedCollections = selectedCollections.filter(c => 
      c.id !== collection.id
    );
    
    setSelectedCollections(newSelectedCollections);
    
    setChatCollections(chat.id, newSelectedCollections)
      .catch(error => {
        debug('Error updating collections:', error);
      })
      .finally(() => {
        setIsUpdating(false);
      });
  };
  
  // Handle search input changes
  const handleSearchChange = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setSearchQuery(target.value);
  };
  
  // Open dialog
  const openDialog = () => setIsDialogOpen(true);
  
  // Close dialog
  const closeDialog = () => {
    setIsDialogOpen(false);
    setIsUpdating(false);
  };
  
  // Handle click away
  const handleClickAway = () => {
    if (isDialogOpen) {
      closeDialog();
    }
  };
  
  return (
    <div>
      <Tooltip 
        content={
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.Knowledge')}</div>
            <div>Attach knowledge sources to search for relevant context (Shift+Alt+K)</div>
          </div>
        } 
        relationship="description"
        positioning="above"
      >
        <Button
          aria-label={t('Common.Knowledge')}
          className="justify-start text-color-secondary"
          style={{ padding: 1, minWidth: 20, borderColor: 'transparent', boxShadow: 'none' }}
          icon={<KnowledgeIcon />}
          size="small"
          appearance="subtle"
          onClick={openDialog}
        >
          {selectedCollections.length > 0 && selectedCollections.length}
        </Button>
      </Tooltip>

      <Dialog open={isDialogOpen} onOpenChange={(event, data) => data.open === false && closeDialog()}>
        <DialogSurface style={{ width: '500px', maxWidth: '90vw' }}>
          <DialogBody>
            <DialogTitle
              action={
                <Button
                  appearance="subtle"
                  aria-label="close"
                  onClick={closeDialog}
                  icon={<Dismiss24Regular />}
                />
              }
            >
              {t('Knowledge.Collection')}
            </DialogTitle>
            <DialogContent>
              <div className={styles.fixedHeightContainer}>
                <div className={styles.comboboxContainer}>
                  <Combobox
                    multiselect
                    placeholder={t('Knowledge.SelectCollection')}
                    appearance="outline"
                    selectedOptions={selectedIds}
                    onOptionSelect={handleCollectionSelect}
                    style={{ width: '100%' }}
                  >
                    <input
                      value={searchQuery}
                      onChange={handleSearchChange}
                      style={{ display: 'none' }}
                    />
                    {filteredCollections.map((collection) => (
                      <Option
                        key={collection.id}
                        value={collection.id}
                        text={collection.name}
                        disabled={collection.numOfFiles === 0 && !isOmnibaseCollection(collection)}
                      >
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center">
                            {isOmnibaseCollection(collection) && (
                              <span className="mr-1 text-blue-400">
                                <CloudIcon />
                              </span>
                            )}
                            {collection.name}
                          </div>
                          <div>
                            {isOmnibaseCollection(collection) ? (
                              t('Knowledge.OmniBase')
                            ) : (
                              `${collection.numOfFiles} ${t('Common.files')}`
                            )}
                          </div>
                        </div>
                      </Option>
                    ))}
                    {collections.length > MAX_VISIBLE_OPTIONS && (
                      <Option key="more-results" value="" disabled>
                        {t('Common.TypeToSearch')}
                      </Option>
                    )}
                  </Combobox>
                </div>
                
                <div className={styles.dividerContainer}>
                  <Divider>{t('Editor.Toolbar.KnowledgeCtrl.SelectedCollections')}</Divider>
                </div>
                
                <div className={styles.selectedContainer}>
                  {isUpdating ? (
                    <div className={styles.statusMessage}>
                      {t('Common.Updating')}...
                    </div>
                  ) : selectedCollections.length === 0 ? (
                    <div className={styles.statusMessage}>
                      {t('Knowledge.NoCollectionsSelected')}
                    </div>
                  ) : (
                    <div>
                      {selectedCollections.map((collection) => (
                        <div
                          className={styles.collectionItem}
                          key={collection.id}
                        >
                          <div className="flex justify-start gap-1 items-center">
                            {isOmnibaseCollection(collection) && (
                              <CloudIcon className="text-blue-500" />
                            )}
                            <span className="font-semibold">{collection.name}</span>
                            <span className="inline-block ml-2 text-xs">
                              {isOmnibaseCollection(collection) ? (
                                t('Knowledge.OmniBase')
                              ) : (
                                `(${collection.numOfFiles} ${t('Common.files')})`
                              )}
                            </span>
                          </div>
                          <Button
                            icon={<DismissCircle16Regular />}
                            appearance="subtle"
                            onClick={() => handleCollectionRemove(collection)}
                            disabled={isUpdating}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
