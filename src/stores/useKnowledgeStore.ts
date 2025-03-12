import { create } from 'zustand';
import Debug from 'debug';
import { ICollection, ICollectionFile, IKnowledgeChunk } from 'types/knowledge';
import { typeid } from 'typeid-js';
import { date2unix } from 'utils/util';
import { isUndefined, omitBy } from 'lodash';

const debug = Debug('OMNI-OS:stores:useKnowledgeStore');

export interface IKnowledgeStore {
  collectionChangedAt: number | null;
  citation: { open: boolean; content: string };
  chunks: { [key: string]: IKnowledgeChunk }; // cache chunks
  showCitation: (content: string) => void;
  hideCitation: () => void;
  cacheChunks: (chunk: IKnowledgeChunk[]) => void;
  getChunk: (id: string) => Promise<IKnowledgeChunk | null>;
  createCollection: (collection: Partial<ICollection>) => Promise<ICollection>;
  updateCollection: (
    collection: { id: string } & Partial<ICollection>
  ) => Promise<boolean>;
  deleteCollection: (id: string) => Promise<boolean>;
  listCollections: () => Promise<ICollection[]>;
  getCollection: (id: string) => Promise<ICollection | null>;
  createFile: (
    file: { collectionId: string; name: string } & Partial<ICollectionFile>
  ) => Promise<ICollectionFile>;
  getFiles: (fileIds: string[]) => Promise<ICollectionFile[]>;
  deleteFile: (id: string) => Promise<boolean>;
  listFiles: (collectionId: string) => Promise<ICollectionFile[]>;
  testOmniBaseConnection: (indexName: string, namespace?: string) => Promise<{ success: boolean; message: string }>;
  createOmniBaseCollection: (name: string, indexName: string, namespace?: string) => Promise<ICollection | null>;
}

const useKnowledgeStore = create<IKnowledgeStore>((set, get) => ({
  collectionChangedAt: null,
  citation: { open: false, content: '' },
  chunks: {},
  showCitation: (content) => {
    set({ citation: { open: true, content } });
  },
  hideCitation: () => {
    set({ citation: { open: false, content: '' } });
  },
  cacheChunks: (chunks: IKnowledgeChunk[]) => {
    set((state) => {
      chunks.forEach((chunk) => {
        state.chunks[chunk.id] = chunk;
      });
      return state;
    });
  },
  getChunk: async (id) => {
    let chunk = get().chunks[id];
    if (!chunk) {
      chunk = await window.electron.knowledge.getChunk(id);
      if (chunk) {
        set((state) => {
          state.chunks[id] = chunk;
          return state;
        });
      }
    }
    return chunk;
  },
  createCollection: async (collection) => {
    const nowUnix = date2unix(new Date());
    const _collection = {
      ...collection,
      id: collection.id || typeid('kc').toString(),
      createdAt: nowUnix,
      updatedAt: nowUnix,
    } as ICollection;

    const ok = await window.electron.db.run(
      `INSERT INTO knowledge_collections (id, name, memo,  createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)`,
      [
        _collection.id,
        _collection.name,
        _collection.memo,
        _collection.createdAt,
        _collection.updatedAt,
      ]
    );
    if (!ok) {
      throw new Error(`Create collection "${_collection.name}" failed`);
    }
    set((state) => ({
      collectionChangedAt: nowUnix,
    }));
    debug('Create a knowledge collection ', _collection);
    return _collection as ICollection;
  },
  updateCollection: async (collection) => {
    const nowUnix = date2unix(new Date());
    const params = [];
    const columns = [];
    if (collection.name) {
      params.push(collection.name);
      columns.push('name = ?');
    }
    if (collection.memo) {
      params.push(collection.memo);
      columns.push('memo = ?');
    }
    if (!isUndefined(collection.pinedAt)) {
      params.push(collection.pinedAt);
      columns.push('pinedAt = ?');
    }
    if (!isUndefined(collection.type)) {
      params.push(collection.type);
      columns.push('type = ?');
    }
    if (!isUndefined(collection.indexName)) {
      params.push(collection.indexName);
      columns.push('indexName = ?');
    }
    if (!isUndefined(collection.namespace)) {
      params.push(collection.namespace);
      columns.push('namespace = ?');
    }
    params.push(nowUnix);
    columns.push('updatedAt = ?');
    params.push(collection.id);
    const sql = `UPDATE knowledge_collections SET ${columns.join(
      ', '
    )} WHERE id = ?`;
    const ok = await window.electron.db.run(sql, params);
    if (!ok) {
      throw new Error(`Update collection "${collection.id}" failed`);
    }
    set((state) => ({
      collectionChangedAt: nowUnix,
    }));
    debug('updateCollection', params);
    return true;
  },
  deleteCollection: async (id) => {
    const ok = await window.electron.db.transaction([
      {
        sql: `DELETE FROM knowledge_collections WHERE id = ?`,
        params: [id],
      },
      {
        sql: `DELETE FROM knowledge_files WHERE collectionId = ?`,
        params: [id],
      },
      {
        sql: `DELETE FROM chat_knowledge_rels WHERE collectionId = ?`,
        params: [id],
      },
    ]);
    if (!ok) {
      throw new Error(`Delete knowledge collection(${id}) failed`);
    }
    await window.electron.knowledge.removeCollection(id);
    set((state) => ({
      collectionChangedAt: date2unix(new Date()),
      chunks: omitBy(
        state.chunks,
        (chunk: IKnowledgeChunk) => chunk.collectionId === id
      ),
    }));
    console.log('deleteCollection, id:', id, ' at ', get().collectionChangedAt);
    return true;
  },
  listCollections: async () => {
    debug('Query collections from db');
    
    try {
      // Check if the type column exists in the knowledge_collections table
      const columns = await window.electron.db.all(
        `PRAGMA table_info(knowledge_collections)`,
        []
      );
      
      const hasTypeColumn = columns.some((col: any) => col.name === 'type');
      
      if (hasTypeColumn) {
        // If the type column exists, we can query both types of collections at once
        const allCollections = await window.electron.db.all(
          `
          SELECT c.id, c.name, c.memo, c.type, c.indexName, c.namespace, c.updatedAt, c.createdAt, c.pinedAt, 
                 CASE WHEN c.type = 'omnibase' THEN 0 ELSE count(f.id) END AS numOfFiles 
          FROM knowledge_collections c
          LEFT JOIN knowledge_files f on f.collectionId = c.id
          GROUP BY c.id, c.name, c.memo, c.type, c.indexName, c.namespace, c.updatedAt, c.createdAt, c.pinedAt
          ORDER BY c.pinedAt DESC, c.updatedAt DESC`,
          []
        );
        
        return allCollections as ICollection[];
      } else {
        // Fallback to the old way - only local collections
        const localCollections = await window.electron.db.all(
          `
          SELECT c.id, c.name, c.memo, c.updatedAt, c.createdAt, c.pinedAt, count(f.id) AS numOfFiles 
          FROM knowledge_collections c
          LEFT JOIN knowledge_files f on f.collectionId = c.id
          GROUP BY c.id, c.name, c.memo, c.updatedAt, c.createdAt, c.pinedAt
          ORDER BY c.pinedAt DESC, c.updatedAt DESC`,
          []
        ) as any[];
        
        // Mark local collections as type 'local'
        return localCollections.map(collection => ({
          ...collection,
          type: 'local' as const
        })) as ICollection[];
      }
    } catch (error) {
      debug('Error listing collections:', error);
      return [];
    }
  },
  getCollection: async (id) => {
    debug('getCollection', id);
    return (await window.electron.db.get(
      `SELECT id, name, memo FROM knowledge_collections WHERE id = ?`,
      id
    )) as ICollection | null;
  },
  createFile: async (file: Partial<ICollectionFile>) => {
    try {
      // Ensure file has required properties
      if (!file.name || !file.collectionId) {
        throw new Error('File name and collection ID are required');
      }
      
      debug('Creating collection file:', file.name);
      
      // First, check if this file already exists by ID (if ID is provided)
      if (file.id) {
        const existingByExactId = await window.electron.db.get(
          `SELECT * FROM knowledge_files WHERE id = ?`,
          file.id
        );
        
        if (existingByExactId) {
          debug(`File with ID ${file.id} already exists, returning existing record`);
          return existingByExactId as ICollectionFile;
        }
      }
      
      // Also check if a file with the same name exists in this collection
      const existingByName = await window.electron.db.get(
        `SELECT * FROM knowledge_files WHERE collectionId = ? AND name = ?`,
        [file.collectionId, file.name]
      );
      
      if (existingByName) {
        debug(`File with name "${file.name}" already exists in collection, returning existing record`);
        return existingByName as ICollectionFile;
      }
      
      // Generate a unique filename if a file with this name already exists
      let finalName = file.name;
      let nameCheck = await window.electron.db.get(
        `SELECT * FROM knowledge_files WHERE collectionId = ? AND name = ?`,
        [file.collectionId, finalName]
      );
      
      // If a file with this name exists, append a suffix to make it unique
      let suffixCounter = 1;
      const originalName = finalName;
      const extension = originalName.includes('.') 
        ? `.${originalName.split('.').pop()}`
        : '';
      const nameWithoutExtension = extension
        ? originalName.slice(0, originalName.length - extension.length)
        : originalName;
        
      while (nameCheck) {
        finalName = `${nameWithoutExtension} (${suffixCounter})${extension}`;
        suffixCounter++;
        nameCheck = await window.electron.db.get(
          `SELECT * FROM knowledge_files WHERE collectionId = ? AND name = ?`,
          [file.collectionId, finalName]
        );
      }
      
      // Proceed with file creation
      const nowUnix = date2unix(new Date());
      const _file = {
        ...file,
        name: finalName, // Use the potentially modified name
        id: file.id || typeid('kf').toString(),
        createdAt: nowUnix,
        updatedAt: nowUnix,
      } as ICollectionFile;
      
      debug('Creating collection file with ID', _file.id);
      
      try {
        const ok = await window.electron.db.run(
          `INSERT INTO knowledge_files (id, collectionId, name, size, numOfChunks, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            _file.id,
            _file.collectionId,
            _file.name,
            _file.size,
            _file.numOfChunks,
            _file.createdAt,
            _file.updatedAt,
          ]
        );
        
        if (!ok) {
          debug('Insert operation returned false, checking if file already exists');
          // Double-check if the file already exists before throwing an error
          const existingAfterAttempt = await window.electron.db.get(
            `SELECT * FROM knowledge_files WHERE id = ?`,
            _file.id
          );
          
          if (existingAfterAttempt) {
            debug(`File appears to exist despite insert failure, returning existing record`);
            return existingAfterAttempt as ICollectionFile;
          }
          
          throw new Error(`Insert into knowledge_files table failed`);
        }
      } catch (dbError: any) {
        // Check if the error is a UNIQUE constraint error
        if (dbError.message && dbError.message.includes('UNIQUE constraint failed')) {
          debug(`Duplicate file ID detected: ${_file.id}, attempting to fetch existing record`);
          
          // First try to get the file with the exact ID that caused the conflict
          const conflictingFile = await window.electron.db.get(
            `SELECT * FROM knowledge_files WHERE id = ?`,
            _file.id
          );
          
          if (conflictingFile) {
            debug(`Successfully retrieved existing file with ID ${_file.id}`);
            return conflictingFile as ICollectionFile;
          }
          
          // If we can't find the exact ID (unlikely), look for the file by name
          const fileWithSameName = await window.electron.db.get(
            `SELECT * FROM knowledge_files WHERE collectionId = ? AND name = ?`,
            [_file.collectionId, _file.name]
          );
          
          if (fileWithSameName) {
            debug(`Found file with same name in collection: ${_file.name}`);
            return fileWithSameName as ICollectionFile;
          }
          
          // If we still can't find it, try retrieving any recently created files
          const recentFiles = await window.electron.db.all(
            `SELECT * FROM knowledge_files WHERE collectionId = ? ORDER BY createdAt DESC LIMIT 5`,
            [_file.collectionId]
          ) as ICollectionFile[];
          
          if (recentFiles && recentFiles.length > 0) {
            // Find a file with similar name if possible
            const fileName = _file.name || '';  // Use empty string if file.name is undefined
            const similarFile = recentFiles.find((f) => 
              f.name.toLowerCase().includes(fileName.toLowerCase()) || 
              fileName.toLowerCase().includes(f.name.toLowerCase())
            );
            
            if (similarFile) {
              debug(`Found a similar file that might be the duplicate: ${similarFile.name}`);
              return similarFile;
            }
            
            // If no similar file, return the most recent one
            debug(`Returning most recent file in collection as fallback`);
            return recentFiles[0] as ICollectionFile;
          }
        }
        
        // For any other database error, add more context to the error message
        debug('Database error during file creation:', dbError);
        throw new Error(`Create collection file "${file.name}" failed: ${dbError.message || 'Database error'}`);
      }
      
      set((state) => ({
        collectionChangedAt: date2unix(new Date()),
      }));
      
      return _file as ICollectionFile;
    } catch (error: any) {
      debug('Error creating file:', error);
      throw new Error(`Create collection file "${file.name}" failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  deleteFile: async (id) => {
    const ok = await window.electron.db.run(
      `DELETE FROM knowledge_files WHERE id = ?`,
      [id]
    );
    if (!ok) {
      throw new Error(`Delete knowledge file(${id}) failed`);
    }
    set((state) => ({
      collectionChangedAt: date2unix(new Date()),
      chunks: omitBy(
        state.chunks,
        (chunk: IKnowledgeChunk) => chunk.fileId === id
      ),
    }));
    debug(`Delete knowledge file(${id}) success`);
    return true;
  },
  getFiles: async (fileIds) => {
    return (await window.electron.db.all(
      `
    SELECT
      id,
      name,
      size,
      numOfChunks,
      createdAt,
      updatedAt
    FROM
      knowledge_files
    WHERE
      id IN (${fileIds.map((f) => `'${f}'`).join(',')})
    ORDER BY
      updatedAt DESC`,
      []
    )) as ICollectionFile[];
  },
  listFiles: async (collectionId: string) => {
    return (await window.electron.db.all(
      `
    SELECT
      id,
      name,
      size,
      numOfChunks,
      createdAt,
      updatedAt
    FROM
      knowledge_files
    WHERE
      collectionId = ?
    ORDER BY
      updatedAt DESC`,
      [collectionId]
    )) as ICollectionFile[];
  },
  testOmniBaseConnection: async (indexName, namespace) => {
    if (!window.electron.knowledge.testOmniBaseConnection) {
      debug('testOmniBaseConnection method not available');
      return { success: false, message: 'Method not available' };
    }
    return await window.electron.knowledge.testOmniBaseConnection(indexName, namespace);
  },
  createOmniBaseCollection: async (name, indexName, namespace) => {
    try {
      if (!window.electron.knowledge.createOmniBaseCollection) {
        debug('createOmniBaseCollection method not available');
        return null;
      }
      
      // Calculate what the ID would be to check if it already exists
      const expectedId = `omnibase:${indexName}${namespace ? `:${namespace}` : ''}`;
      
      // Check if a collection with this ID already exists
      const existingCollection = await window.electron.db.get(
        `SELECT id, name, type, indexName, namespace FROM knowledge_collections WHERE id = ?`,
        expectedId
      );
      
      if (existingCollection) {
        debug('OMNIBase collection already exists:', existingCollection);
        
        // Return the existing collection - no need to create a new one
        return existingCollection as ICollection;
      }
      
      // Collection doesn't exist, proceed with creation
      const result = await window.electron.knowledge.createOmniBaseCollection(name, indexName, namespace);
      
      if (!result.success) {
        debug('Failed to create OMNIBase collection:', result.message);
        return null;
      }

      const collection = result.collection;

      // Save the OMNIBase collection to the database
      const nowUnix = date2unix(new Date());
      
      // Insert as new collection
      const ok = await window.electron.db.run(
        `INSERT INTO knowledge_collections (id, name, type, indexName, namespace, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          collection.id,
          collection.name,
          'omnibase',
          collection.indexName,
          collection.namespace,
          collection.createdAt,
          collection.updatedAt,
        ]
      );

      if (!ok) {
        throw new Error(`Create OMNIBase collection "${collection.name}" failed`);
      }

      set((state) => ({
        collectionChangedAt: nowUnix,
      }));

      debug('Created OMNIBase collection:', collection);
      return collection as ICollection;
    } catch (error) {
      debug('Error creating OMNIBase collection:', error);
      return null;
    }
  },
}));

export default useKnowledgeStore;
