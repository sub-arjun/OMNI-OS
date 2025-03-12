import {
  Drawer,
  DrawerHeader,
  DrawerHeaderTitle,
  Button,
  DrawerBody,
  Divider,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
} from '@fluentui/react-components';
import {
  CheckmarkCircle16Filled,
  Delete16Regular,
  Dismiss24Regular,
  DocumentArrowRight20Regular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import useToast from 'hooks/useToast';
import { typeid } from 'typeid-js';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useAppearanceStore from 'stores/useAppearanceStore';
import { ICollectionFile } from 'types/knowledge';
import { fileSize, paddingZero } from 'utils/util';
import useNav from 'hooks/useNav';

// Generate a UUID using the browser's crypto API
function generateUUID() {
  // Generate a random 128-bit value as 16 bytes
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  
  // Format it as a UUID (version 4)
  // Set the version bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;  // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80;  // Variant 1
  
  // Convert to hex strings
  const hexValues = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
  
  // Format as UUID with hyphens
  return `kf_${hexValues.slice(0, 4).join('')}${hexValues.slice(4, 6).join('')}${hexValues.slice(6, 8).join('')}${hexValues.slice(8, 10).join('')}${hexValues.slice(10).join('')}`;
}

export default function FileDrawer({
  collection,
  open,
  setOpen,
}: {
  collection: any;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNav();
  const { notifyError, notifySuccess } = useToast();
  const getPalette = useAppearanceStore((state) => state.getPalette);
  const { listFiles, deleteFile, createFile } = useKnowledgeStore();

  const [files, setFiles] = useState<File[]>([]);
  const [fileList, setFileList] = useState<ICollectionFile[]>([]);
  const [progresses, setProgresses] = useState<{ [key: string]: number }>({});

  const [fileStatus, setFileStatus] = useState<{ [key: string]: boolean }>({
    'model_quantized.onnx': false,
    'config.json': false,
    'tokenizer_config.json': false,
    'tokenizer.json': false,
  });

  const isEmbeddingModelReady = useMemo(() => {
    return Object.values(fileStatus).every((item) => item);
  }, [fileStatus]);

  useEffect(() => {
    window.electron.embeddings.getModelFileStatus().then((fileStatus: any) => {
      setFileStatus(fileStatus);
    });
    setFiles([]);
    setProgresses({});
    
    // Listener for import progress
    const progressHandler = (filePath: unknown, total: unknown, done: unknown) => {
      const percent = Math.ceil(((done as number) / (total as number)) * 100);
      setProgresses((prev) => ({
        ...prev,
        [filePath as string]: percent,
      }));
    };
    
    window.electron.ipcRenderer.on('knowledge-import-progress', progressHandler);

    listFiles(collection.id).then((files: any[]) => {
      setFileList(files);
    });

    return () => {
      window.electron.ipcRenderer.unsubscribe('knowledge-import-progress', progressHandler);
    };
  }, [collection]);

  const importFiles = async (files: File[]) => {
    // Reset files
    setFiles(files);
    
    const collectionId = collection.id;
    
    // Keep track of files that were processed successfully to avoid duplicates
    const processedFiles = new Set<string>();
    
    // Also track file IDs to prevent duplicates
    const usedFileIds = new Set<string>();
    
    // Reference to track successful imports
    const importedCount = { value: 0 };
    
    // To prevent multiple simultaneous imports of the same file, store import promises
    const pendingImports = new Map<string, Promise<any>>();
    
    // Track files already being created in the database to avoid duplicate operations
    const filesBeingCreated = new Map<string, Promise<any>>();
    
    // Set up a listener for when files are successfully imported
    const successHandler = async (event: any, data: any) => {
      try {
        // Create the file record in the database
        if (data && data.file && data.collectionId) {
          const fileId = data.file.id;
          
          // Check if we already processed this file ID
          if (usedFileIds.has(fileId)) {
            console.log(`Already processed file with ID ${fileId}, skipping database creation`);
            return;
          }
          
          // Check if this file is currently being created
          if (filesBeingCreated.has(fileId)) {
            console.log(`File creation for ${fileId} already in progress, waiting...`);
            try {
              // Wait for the existing creation to finish
              await filesBeingCreated.get(fileId);
              // Since it's already created, we don't need to do anything else
              usedFileIds.add(fileId);
              return;
            } catch (err) {
              console.error(`Error waiting for file creation: ${err}`);
              // Continue with creation as the previous attempt may have failed
            }
          }
          
          // Add a small delay to avoid race conditions with multiple successive requests
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Create a promise for the file creation process
          const createPromise = (async () => {
            try {
              await createFile({
                id: fileId,
                collectionId: data.collectionId,
                name: data.file.name,
                size: data.file.size,
                numOfChunks: data.numOfChunks || 0
              });
              
              // Increment counter of successfully imported files
              importedCount.value++;
              
              // Only update the file list after a successful file creation
              const updatedFiles = await listFiles(collection.id);
              setFileList(updatedFiles);
              
              // Only show success message for the first file to avoid flooding
              if (importedCount.value === 1) {
                notifySuccess(t('Knowledge.Notification.FileImported'));
              }
              
              // Mark this file ID as used
              usedFileIds.add(fileId);
              
              return true;
            } catch (fileCreateError: any) {
              console.error('Error creating file record:', fileCreateError);
              
              // Only show error if it's not a duplicate (those are handled gracefully)
              if (!fileCreateError.message?.includes('UNIQUE constraint failed') && 
                  !fileCreateError.message?.includes('already exists')) {
                notifyError(`${t('Knowledge.Notification.ImportFailed')}: ${data.file.name}`);
              } else {
                // For duplicate errors, still refresh the file list as it might have been created
                console.log(`Duplicate file detected: ${data.file.name}, but will still refresh file list`);
                
                // Count as success since the file exists
                importedCount.value++;
                
                // Refresh file list to show the existing file
                const updatedFiles = await listFiles(collection.id);
                setFileList(updatedFiles);
                
                // Mark this file ID as used to prevent further attempts
                usedFileIds.add(fileId);
              }
              
              return false;
            } finally {
              // Remove from the map of files being created
              filesBeingCreated.delete(fileId);
            }
          })();
          
          // Store the creation promise
          filesBeingCreated.set(fileId, createPromise);
          
          // Await the creation
          await createPromise;
        }
      } catch (err) {
        console.error('Failed to process import success:', err);
        // Only show error message if we haven't already imported files successfully
        if (importedCount.value === 0) {
          notifyError(t('Knowledge.Notification.ImportFailed'));
        }
      }
    };
    
    try {
      // First filter out duplicates by name+path combination
      const uniqueFiles = files.filter((file, index, self) => 
        index === self.findIndex(f => f.name === file.name && f.path === file.path)
      );
      
      // Only proceed if we have files to import
      if (uniqueFiles.length === 0) {
        console.log('No unique files to import');
        return;
      }
      
      // Register listener for import success - ensure we register only once per import batch
      window.electron.ipcRenderer.on('knowledge-import-success', successHandler);
      
      // Keep track of all import promises to wait for all to complete
      const allImportPromises: Promise<any>[] = [];
      
      for (const file of uniqueFiles) {
        // Skip already processed files with the same name and path
        const fileKey = `${file.name}:${file.path}`;
        if (processedFiles.has(fileKey)) {
          continue;
        }
        
        // Mark file as being processed to prevent duplicates
        processedFiles.add(fileKey);
        
        try {
          // Generate a truly unique ID using our UUID generator
          const fileId = generateUUID();
          
          // Skip if this file ID is already being processed
          if (pendingImports.has(fileId)) {
            console.log(`Already importing file with ID ${fileId}, skipping duplicate import`);
            continue;
          }
          
          console.log(`Starting import for file ${file.name} with ID ${fileId}`);
          
          // Store the import promise to track concurrent imports
          const importPromise = window.electron.knowledge.importFile({
            file: {
              id: fileId,
              name: file.name,
              path: file.path,
              size: file.size,
              type: file.type || file.name.split('.').pop()?.toLowerCase() || ''
            },
            collectionId,
          });
          
          pendingImports.set(fileId, importPromise);
          
          // Add to all promises to track
          allImportPromises.push(importPromise);
          
          // Execute the import and handle result
          const result = await importPromise;
          
          // Check the result if it's an object with success property
          if (result && typeof result === 'object') {
            if (result.success === false) {
              notifyError(`${t('Knowledge.Notification.ImportFailed')}: ${file.name} - ${result.error || t('Common.UnknownError')}`);
            } else if (result.existing) {
              console.log(`File already exists in database: ${file.name}`);
              // File was already in the database, count as success
              importedCount.value++;
            }
          }
        } catch (error: any) {
          console.error(`Error importing file:`, error);
          // Don't show error for this file if we've already imported files successfully
          if (importedCount.value === 0) {
            notifyError(`${t('Knowledge.Notification.ImportFailed')}: ${file.name} - ${error.message || t('Common.UnknownError')}`);
          }
        }
      }
      
      // Wait for all imports to complete
      await Promise.allSettled(allImportPromises);
      
      // If we imported multiple files, show a summary notification
      if (importedCount.value > 1) {
        notifySuccess(t('Knowledge.Notification.FilesImported', { count: importedCount.value }));
      }
    } finally {
      // Make sure to remove event listener after all files are processed, but with a longer delay
      // to allow any pending success events to be processed
      setTimeout(() => {
        console.log('Removing knowledge-import-success event listener');
        window.electron.ipcRenderer.unsubscribe('knowledge-import-success', successHandler);
      }, 3000); // Use a longer timeout to ensure all events are processed
    }
  };

  const removeFile = async (fileId: string) => {
    const ok = await window.electron.knowledge.removeFile(fileId);
    if (!ok) {
      notifyError(t('Knowledge.Notification.FileNotDeleted'));
      return;
    }
    await deleteFile(fileId);
    notifySuccess(t('Knowledge.Notification.FileDeleted'));
    listFiles(collection.id).then((files: any[]) => {
      setFileList(files);
    });
  };

  return (
    <Drawer
      position="end"
      open={open}
      onOpenChange={(_, { open }) => setOpen(open)}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close"
              icon={<Dismiss24Regular />}
              onClick={() => setOpen(false)}
            />
          }
        >
          {collection?.name}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className="mt-2.5 flex flex-col gap-2 relative overflow-x-hidden">
        <div>
          {files.map((file: File) => (
            <div
              key={file.path}
              className="flex justify-between items-center py-1"
            >
              <div className="flex justify-start items-center truncate">
                <DocumentArrowRight20Regular className="flex-shrink-0 text-gray-500" />
                <div className="truncate mr-5 ml-1">{file.name}</div>
              </div>
              <div className="w-7 flex-shrink-0">
                {progresses[file.path] >= 100 ? (
                  <CheckmarkCircle16Filled
                    style={{ color: getPalette('success') }}
                  />
                ) : (
                  <span>{progresses[file.path] || 0}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
        {fileList.length > 0 && (
          <div>
            <Divider>{t('Knowledge.Divider.Files')}</Divider>
            {fileList.map((file: ICollectionFile, index: number) => (
              <div
                key={file.id}
                className="flex justify-between items-center py-1"
              >
                <div className="w-44 truncate">
                  <span className="mr-1 number text-gray-500">
                    {paddingZero(index + 1, 2)}.
                  </span>
                  <span>{file.name}</span>
                </div>
                <span className="number text-left">{fileSize(file.size)}</span>
                <Button
                  size="small"
                  icon={<Delete16Regular />}
                  appearance="subtle"
                  onClick={() => removeFile(file.id)}
                />
              </div>
            ))}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          {isEmbeddingModelReady ? (
            <>
              <Button className="w-full" appearance="primary" onClick={()=>{
                window.electron.knowledge.selectFiles().then((data: any) => {
                  importFiles(JSON.parse(data));
                });
              }}>
              {t('Knowledge.Action.AddFiles')}
              </Button>
            </>
          ) : (
            <Dialog>
            <DialogTrigger disableButtonEnhancement>
            <Button className="w-full" appearance="primary">
                {t('Knowledge.Action.AddFiles')}
              </Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>{t('Knowledge.FileDrawer.DialogTitle.EmbeddingModelIsMissing')}</DialogTitle>
                <DialogContent>
                  <p>{t('Knowledge.FileDrawer.DialogContent.EmbeddingModelIsRequired')}</p>
                </DialogContent>
                <DialogActions>
                  <DialogTrigger disableButtonEnhancement>
                    <Button appearance="secondary">Close</Button>
                  </DialogTrigger>
                  <Button appearance="primary" onClick={() => navigate('/settings')}>Go Settings</Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
          )}
        </div>

      </DrawerBody>
    </Drawer>
  );
}
