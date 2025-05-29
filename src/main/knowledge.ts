import path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import { Schema, Field, FixedSizeList, Utf8, Float16 } from 'apache-arrow';
import { captureException } from '../main/logging';
import { Data } from '@lancedb/lancedb';
import { loadDocument } from './docloader';
import { randomId, smartChunk } from './util';
import { embed } from './embedder';
import { Pinecone } from '@pinecone-database/pinecone';

const TABLE_NAME = 'knowledge';
const dim = 1024;

const knowledgeSchema = new Schema([
  new Field('id', new Utf8()),
  new Field('collection_id', new Utf8()),
  new Field('file_id', new Utf8()),
  new Field('content', new Utf8()),
  new Field(
    'vector',
    new FixedSizeList(dim, new Field('item', new Float16(), true)),
    false
  ),
]);

export default class Knowledge {
  private static db: any;
  private static pinecone: Pinecone | null;
  private static llamaCloudIndexes: Record<string, any> = {};

  public static async getDatabase() {
    if (!this.db) {
      try {
        this.db = await this.init();
      } catch (err: any) {
        captureException(err);
      }
    }
    return this.db;
  }

  private static async init() {
    const lancedb = await import('@lancedb/lancedb');
    const uri = path.join(app.getPath('userData'), 'lancedb.db');
    const db = await lancedb.connect(uri);
    const tableNames = await db.tableNames();
    log.debug('Existing tables:', tableNames.join(', '));
    if (!tableNames.includes(TABLE_NAME)) {
      await db.createEmptyTable(TABLE_NAME, knowledgeSchema);
      log.debug('create table knowledge');
    }
    return db;
  }

  public static async close() {
    if (!this.db) return;
    await this.db.close();
    this.db = null;
  }

  /**
   * Remove knowledge records from the database
   * @param params Object with either collectionId or fileId to specify what to remove
   * @returns boolean indicating success/failure
   */
  public static async remove(params: { collectionId?: string | number, fileId?: string }) {
    try {
      log.debug(`Knowledge.remove called with params:`, params);
      
      if (!params.collectionId && !params.fileId) {
        log.error('Knowledge.remove: Missing collectionId or fileId parameter');
        return false;
      }
      
      const db = await this.getDatabase();
      const table = await db.openTable(TABLE_NAME);
      
      let whereClause = '';
      if (params.collectionId) {
        whereClause = `collection_id = "${params.collectionId}"`;
        log.debug(`Removing knowledge records for collection: ${params.collectionId}`);
      } else if (params.fileId) {
        whereClause = `file_id = "${params.fileId}"`;
        log.debug(`Removing knowledge records for file: ${params.fileId}`);
      }
      
      if (whereClause) {
        // Get records to delete first
        const recordsToDelete = await table.query().where(whereClause).select(['id']).toArray();
        log.debug(`Found ${recordsToDelete.length} records to delete`);
        
        if (recordsToDelete.length > 0) {
          // LanceDB doesn't have a direct delete method on query
          // We need to use the delete method on the table
          // Build array of IDs to delete
          const idsToDelete = recordsToDelete.map((record: any) => record.id);
          
          // Delete rows by ID filter
          await table.delete(`id IN (${idsToDelete.map((id: string) => `"${id}"`).join(',')})`);
          log.debug(`Successfully deleted ${idsToDelete.length} records`);
        }
      }
      
      await table.close();
      return true;
    } catch (error: any) {
      log.error('Error in Knowledge.remove:', error);
      captureException(error);
      return false;
    }
  }

  public static async importFile({
    file,
    collectionId,
    onProgress,
    onSuccess,
  }: {
    file: {
      id: string;
      path: string;
      name: string;
      size: number;
      type: string;
    };
    collectionId: string;
    onProgress?: (filePath: string, total: number, done: number) => void;
    onSuccess?: (data: any) => void;
  }) {
    try {
      log.debug(`Starting file import: ${file.name} (${file.type}) in collection ${collectionId}`);
      
      // Check if this file was already imported first
      try {
        const db = this.getDb();
        if (db) {
          // Check by ID first
          const existingFile = await db.get(
            `SELECT * FROM knowledge_files WHERE id = ?`,
            file.id
          );
          
          if (existingFile) {
            log.debug(`File with ID ${file.id} already exists in database, skipping vectorization`);
            
            // Still notify success with the existing file data
            if (onSuccess) {
              onSuccess({
                collectionId,
                file: {
                  id: file.id,
                  name: file.name,
                  path: file.path,
                  size: existingFile.size,
                  type: file.type
                },
                numOfChunks: existingFile.numOfChunks || 0,
              });
            }
            
            return;
          }
          
          // Also check by name and collectionId as a fallback
          const existingByName = await db.get(
            `SELECT * FROM knowledge_files WHERE collectionId = ? AND name = ?`,
            [collectionId, file.name]
          );
          
          if (existingByName) {
            log.debug(`File with name "${file.name}" already exists in collection ${collectionId}, skipping vectorization`);
            
            // Still notify success with the existing file data
            if (onSuccess) {
              onSuccess({
                collectionId,
                file: {
                  id: existingByName.id,
                  name: file.name,
                  path: file.path,
                  size: existingByName.size,
                  type: file.type
                },
                numOfChunks: existingByName.numOfChunks || 0,
              });
            }
            
            return;
          }
        }
      } catch (dbError) {
        log.error('Error checking for existing file:', dbError);
        // Continue with import if database check fails
      }
      
      // Extract file extension if not provided directly
      const fileExtension = file.type || file.name.split('.').pop()?.toLowerCase() || '';
      log.debug(`File extension/type: "${fileExtension}"`);
      
      // For PDF files, we need special handling to ensure the correct loader is used
      if (file.name.toLowerCase().endsWith('.pdf') && fileExtension !== 'pdf') {
        log.debug(`PDF file detected based on name: ${file.name}, but type was: ${file.type}. Forcing 'pdf' type.`);
        file.type = 'pdf';
      }
      
      const textContent = await loadDocument(file.path, file.type);
      log.debug(`Document loaded successfully, got ${textContent.length} characters`);
      
      const chunks = smartChunk(textContent);
      log.debug(`Document chunked into ${chunks.length} chunks`);
      
      const vectors = await embed(chunks, (total, done) => {
        if (onProgress) {
          onProgress(file.path, total, done);
        }
      });
      log.debug(`Vectors generated successfully: ${vectors.length}`);
      
      const data = vectors.map((vector: Float32Array, index: number) => {
        return {
          id: randomId(),
          collection_id: collectionId,
          file_id: file.id,
          content: chunks[index],
          vector,
        };
      });
      
      await this.add(data);
      log.debug(`Successfully added ${data.length} entries to database for file: ${file.name}`);
      
      // Call the success callback with the data needed by the client
      if (onSuccess) {
        onSuccess({
          collectionId,
          file: {
            id: file.id,
            name: file.name,
            path: file.path,
            size: file.size,
            type: file.type
          },
          numOfChunks: vectors.length,
        });
      }
    } catch (error: any) {
      log.error(`Error importing file ${file.name} (${file.type}):`, error);
      captureException(error);
      // Re-throw the error so it can be handled by the caller
      throw new Error(`Failed to import file ${file.name}: ${error.message}`);
    }
  }

  public static async add(data: Data, options?: { stayOpen: boolean }) {
    const db = await this.getDatabase();
    const table = await db.openTable(TABLE_NAME);
    await table.add(data);
    if (!options?.stayOpen) {
      await table.close();
    }
  }

  public static async getChunk(id: string, options?: { stayOpen: boolean }) {
    const db = await this.getDatabase();
    const table = await db.openTable(TABLE_NAME);
    log.debug('getChunk: ', id);
    const result = await table
      .query()
      .where(`id = "${id}"`)
      .select(['id', 'collection_id', 'file_id', 'content'])
      .toArray();
    if (!options?.stayOpen) {
      await table.close();
    }
    if (result.length > 0) {
      return {
        id: result[0].id,
        collectionId: result[0].collection_id,
        fileId: result[0].file_id,
        content: result[0].content,
      };
    }
    return null;
  }

  public static async search(
    collectionIds: string[],
    query: string,
    options?: { stayOpen?: boolean; limit?: number }
  ) {
    const results = [];
    const totalLimit = options?.limit || 8; // Default to 8 combined results
    const llamaCloudLimit = 6; // Default limit for LlamaCloud searches
    const localLimit = 4; // Default limit for local LanceDB searches
    
    // Filter out any null or undefined collectionIds
    const validCollectionIds = collectionIds.filter(id => id);
    
    if (validCollectionIds.length === 0) {
      return [];
    }
    
    log.debug(`Knowledge search: query="${query}", collections=${validCollectionIds.join(',')}`);
    log.debug('Collection IDs being searched:', JSON.stringify(validCollectionIds));
    
    // Check which collections are OMNIBase vs. local
    const omnibaseCollections: Array<{indexName: string, namespace?: string}> = [];
    
    // TEMPORARY WORKAROUND: Manually identify known OMNIBase collections by name
    const knownOmnibaseCollections: Record<string, {indexName: string, namespace?: string}> = {
      'smartjet': { indexName: 'smartjet' },
      'omnibase:smartjet': { indexName: 'smartjet' }
      // Add other collections here if needed
    };
    
    // Get collection details to properly identify OMNIBase collections
    let collectionsData = [];
    try {
      collectionsData = await this.getCollectionsInfo(validCollectionIds);
      log.debug(`Retrieved details for ${collectionsData.length} collections`);
      
      // Log collection types to help debug
      if (collectionsData.length > 0) {
        collectionsData.forEach((c: any) => {
          log.debug(`Collection '${c.id}' (${c.name}) has type: ${c.type || 'unspecified'}`);
        });
      }
    } catch (err: any) {
      log.error('Error retrieving collection details:', err);
      captureException(err);
    }
    
    // Process each collection to identify OMNIBase vs local
    for (const collectionId of validCollectionIds) {
      // Check if the ID directly starts with 'omnibase:'
      let isOmnibase = collectionId.startsWith('omnibase:');
      let indexName = '';
      let namespace = undefined;
      
      if (isOmnibase) {
        // Parse the ID to get indexName and namespace
        const parts = collectionId.split(':');
        if (parts.length >= 2) {
          indexName = parts[1];
          namespace = parts.length > 2 ? parts[2] : undefined;
          log.debug(`Collection '${collectionId}' recognized as OMNIBase by prefix`);
        }
      } else {
        // Check if we have collection details to identify it as OMNIBase
        const collectionData = collectionsData.find((c: any) => c.id === collectionId);
        if (collectionData && collectionData.type === 'omnibase') {
          isOmnibase = true;
          indexName = collectionData.indexName;
          namespace = collectionData.namespace;
          log.debug(`Collection '${collectionId}' recognized as OMNIBase by database type`);
        } 
        // Check if it's a known OMNIBase collection by ID
        else if (knownOmnibaseCollections[collectionId]) {
          isOmnibase = true;
          indexName = knownOmnibaseCollections[collectionId].indexName;
          namespace = knownOmnibaseCollections[collectionId].namespace;
          log.debug(`Collection '${collectionId}' recognized as OMNIBase by hardcoded mapping`);
        }
      }
      
      // Add to OMNIBase collections list if identified as such
      if (isOmnibase && indexName) {
        omnibaseCollections.push({ indexName, namespace });
        log.debug(`Added OMNIBase collection: index=${indexName}, namespace=${namespace || 'default'}`);
      } else {
        log.debug(`Collection '${collectionId}' will be treated as local`);
      }
    }
    
    // Get the IDs of collections that were identified as OMNIBase
    const omnibaseCollectionIds = new Set(
      collectionsData
        .filter((c: any) => c.type === 'omnibase')
        .map((c: any) => c.id)
    );
    
    // Get IDs that start with 'omnibase:'
    const prefixedOmnibaseIds = new Set(
      validCollectionIds.filter(id => id.startsWith('omnibase:'))
    );
    
    // Combine both sets to get all OMNIBase collection IDs
    const allOmnibaseIds = new Set([...omnibaseCollectionIds, ...prefixedOmnibaseIds]);
    
    // Get local collection IDs - filter out all identified OMNIBase collections
    const localCollectionIds = validCollectionIds.filter(id => !allOmnibaseIds.has(id));
    
    // Debug logging to help identify the issue
    log.debug(`Identified OMNIBase collections: ${[...allOmnibaseIds].join(', ') || 'none'}`);
    log.debug(`Identified local collections: ${localCollectionIds.join(', ') || 'none'}`);
    
    // Set up search promises for both OMNIBase and local searches to run in parallel
    const searchPromises = [];
    
    // Process OMNIBase collections
    if (omnibaseCollections.length > 0) {
      log.debug(`Found ${omnibaseCollections.length} OMNIBase collections to search`);
      
      // Create OMNIBase search promise
      const omnibaseSearchPromise = new Promise<any[]>(async (resolve) => {
        try {
          const omnibasePromises = omnibaseCollections.map(({ indexName, namespace }) => 
            this.searchOmniBase(indexName, query, namespace, { limit: llamaCloudLimit })
          );
          
          const omnibaseResults = await Promise.all(omnibasePromises);
          // Flatten and resolve the results
          let flattenedResults = [];
          for (const resultSet of omnibaseResults) {
            flattenedResults.push(...resultSet);
          }
          
          log.debug(`Retrieved ${flattenedResults.length} results from OMNIBase collections`);
          resolve(flattenedResults);
        } catch (err: any) {
          captureException(err);
          log.error('Error searching OMNIBase collections:', err);
          resolve([]); // Return empty array in case of error
        }
      });
      
      searchPromises.push(omnibaseSearchPromise);
    }
    
    // Process local collections
    if (localCollectionIds.length > 0) {
      log.debug(`Found ${localCollectionIds.length} local collections to search: ${localCollectionIds.join(',')}`);
      
      // Create local search promise
      const localSearchPromise = new Promise<any[]>(async (resolve) => {
        try {
          log.debug('Starting local search process...');
    const db = await this.getDatabase();
          if (!db) {
            log.error('Failed to get local database connection');
            resolve([]);
            return;
          }
          
          log.debug('Successfully got LanceDB database connection');
          
          try {
    const table = await db.openTable(TABLE_NAME);
            if (!table) {
              log.error('Failed to open knowledge table in local database');
              resolve([]);
              return;
            }
            
            log.debug(`Successfully opened ${TABLE_NAME} table in LanceDB`);
            
            log.debug('Generating vector embedding for local search');
    const vectors = await embed([query]);
            if (!vectors || vectors.length === 0) {
              log.error('Failed to generate embedding for local search');
              resolve([]);
              return;
            }
            
            log.debug(`Successfully generated embedding with ${vectors[0].length} dimensions`);
            
            // Create the where clause with proper escaping for collection IDs
            const whereClause = localCollectionIds.map(id => 
              // Replace any single quotes in the ID with escaped quotes
              `collection_id = '${id.replace(/'/g, "''")}'`
            ).join(' OR ');
            
            log.debug(`Executing local search with collection filter: ${whereClause}`);
            
            // Execute the search with max limit to ensure we get enough results
            let localResults = [];
            try {
              localResults = await table
                .search(vectors[0])
                .where(whereClause)
                .select(['id', 'collection_id', 'file_id', 'content'])
                .limit(localLimit * 2) // Get more results than needed to ensure we have enough after filtering
                .toArray();
              
              log.debug(`Local search returned ${localResults.length} raw results`);
            } catch (searchError) {
              log.error('Error executing local search:', searchError);
              // Try a simpler search without the where clause as fallback
              log.debug('Trying fallback search without collection filter');
              try {
                localResults = await table
      .search(vectors[0])
                  .select(['id', 'collection_id', 'file_id', 'content'])
                  .limit(localLimit * 2)
      .toArray();
                
                // Manually filter by collection ID after search
                localResults = localResults.filter((item: any) => 
                  localCollectionIds.includes(item.collection_id)
                );
                
                log.debug(`Fallback search returned ${localResults.length} filtered results`);
              } catch (fallbackError) {
                log.error('Fallback search also failed:', fallbackError);
              }
            }
            
    if (!options?.stayOpen) {
      await table.close();
              log.debug('Closed LanceDB table after search');
            }
            
            // Format the results
            const formattedLocalResults = localResults.map((item: any) => {
              // For LanceDB, _distance is a distance metric (lower is better)
              // We need to convert it to a similarity score (higher is better)
              // Distance usually ranges from 0 to 2, with 0 being perfect match
              // First check if _distance exists
              const distance = typeof item._distance === 'number' ? item._distance : 0;
              
              // Convert distance to similarity score (1 - distance/2) to get a 0-1 range
              // Clamp to ensure it's between 0 and 1
              const similarityScore = Math.max(0, Math.min(1, 1 - (distance / 2)));
              
              return {
      id: item.id,
      collectionId: item.collection_id,
      fileId: item.file_id,
      content: item.content,
                score: similarityScore, // Higher score means better match
                originalDistance: distance // Keep original distance for debugging
              };
            });
            
            log.debug(`Formatted ${formattedLocalResults.length} results from local collections`);
            
            // Log a sample of the first result to verify content
            if (formattedLocalResults.length > 0) {
              const firstResult = formattedLocalResults[0];
              log.debug(`First local result sample - id: ${firstResult.id}, collection: ${firstResult.collectionId}, score: ${firstResult.score.toFixed(4)}, originalDistance: ${firstResult.originalDistance.toFixed(4)}, contentLength: ${firstResult.content.length} chars`);
            } else {
              log.warn('No local results found. This may indicate an issue with the local search.');
            }
            
            resolve(formattedLocalResults);
          } catch (tableError) {
            log.error('Error opening or using LanceDB table:', tableError);
            resolve([]);
          }
        } catch (err: any) {
          captureException(err);
          log.error('Error searching local collections:', err);
          resolve([]); // Return empty array in case of error
        }
      });
      
      searchPromises.push(localSearchPromise);
    } else {
      log.debug('No local collections found to search');
    }
    
    // Wait for all searches to complete in parallel
    if (searchPromises.length > 0) {
      const allResults = await Promise.all(searchPromises);
      
      // Combine all results
      let combinedResults = [];
      for (const resultSet of allResults) {
        combinedResults.push(...resultSet);
      }
      
      log.debug(`Combined ${combinedResults.length} results from all sources before ranking`);
      
      // Normalize scores if needed for fair comparison between different sources
      if (combinedResults.length > 0 && searchPromises.length > 1) {
        // Split results by source for analysis
        const omnibaseResults = combinedResults.filter(r => r.collectionId.startsWith('omnibase:'));
        const localResults = combinedResults.filter(r => !r.collectionId.startsWith('omnibase:'));
        
        log.debug(`Pre-normalization: ${omnibaseResults.length} OMNIBase results, ${localResults.length} local results`);
        
        // Calculate score statistics for each source
        if (omnibaseResults.length > 0) {
          const omnibaseMaxScore = Math.max(...omnibaseResults.map(r => r.score || 0));
          const omnibaseMinScore = Math.min(...omnibaseResults.map(r => r.score || 0));
          log.debug(`OMNIBase scores: min=${omnibaseMinScore.toFixed(4)}, max=${omnibaseMaxScore.toFixed(4)}, count=${omnibaseResults.length}`);
        }
        
        if (localResults.length > 0) {
          const localMaxScore = Math.max(...localResults.map(r => r.score || 0));
          const localMinScore = Math.min(...localResults.map(r => r.score || 0));
          log.debug(`Local scores: min=${localMinScore.toFixed(4)}, max=${localMaxScore.toFixed(4)}, count=${localResults.length}`);
        }
        
        // Check if normalization is needed (if score ranges are very different)
        if (omnibaseResults.length > 0 && localResults.length > 0) {
          const omnibaseMaxScore = Math.max(...omnibaseResults.map(r => r.score || 0));
          const localMaxScore = Math.max(...localResults.map(r => r.score || 0));
          
          // If the score scales are significantly different, normalize them
          const scoreDifference = Math.abs(omnibaseMaxScore - localMaxScore);
          if (scoreDifference > 0.3) { // Arbitrary threshold
            log.debug(`Normalizing scores due to large difference in scales: ${scoreDifference.toFixed(4)}`);
            
            // Normalize each group to [0,1] range
            if (omnibaseResults.length > 1) {
              const omnibaseMaxScore = Math.max(...omnibaseResults.map(r => r.score || 0));
              const omnibaseMinScore = Math.min(...omnibaseResults.map(r => r.score || 0));
              const omnibaseRange = omnibaseMaxScore - omnibaseMinScore;
              
              if (omnibaseRange > 0) {
                omnibaseResults.forEach(r => {
                  r.score = (r.score - omnibaseMinScore) / omnibaseRange;
                });
                log.debug(`Normalized OMNIBase scores to [0,1] range`);
              }
            }
            
            if (localResults.length > 1) {
              const localMaxScore = Math.max(...localResults.map(r => r.score || 0));
              const localMinScore = Math.min(...localResults.map(r => r.score || 0));
              const localRange = localMaxScore - localMinScore;
              
              if (localRange > 0) {
                localResults.forEach(r => {
                  r.score = (r.score - localMinScore) / localRange;
                });
                log.debug(`Normalized local scores to [0,1] range`);
              }
            }
            
            // Recombine the results
            combinedResults = [...omnibaseResults, ...localResults];
            log.debug(`After normalization: ${combinedResults.length} total results`);
          }
        }
      }
      
      // Sort all results by relevance score
      combinedResults.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      
      // Ensure we have a mix of results if multiple sources are used
      if (searchPromises.length > 1 && combinedResults.length > totalLimit) {
        // If we have both local and OMNIBase results, try to include at least 2 from each source
        const omnibaseResults = combinedResults.filter(r => r.collectionId.startsWith('omnibase:'));
        const localResults = combinedResults.filter(r => !r.collectionId.startsWith('omnibase:'));
        
        // Only proceed with mixed results if we have both types
        if (omnibaseResults.length > 0 && localResults.length > 0) {
          log.debug(`Ensuring mixed results from ${omnibaseResults.length} OMNIBase and ${localResults.length} local sources`);
          
          // Take the top results from each source
          const mixedResults = [];
          
          // Add top OMNIBase results (up to 4)
          const omnibaseToInclude = Math.min(omnibaseResults.length, 4);
          mixedResults.push(...omnibaseResults.slice(0, omnibaseToInclude));
          
          // Add top local results (up to 4)
          const localToInclude = Math.min(localResults.length, 4);
          mixedResults.push(...localResults.slice(0, localToInclude));
          
          // Fill remaining slots with highest ranked results that aren't already included
          const remainingSlots = totalLimit - mixedResults.length;
          if (remainingSlots > 0) {
            // Create a set of already included result IDs
            const includedIds = new Set(mixedResults.map(r => r.id));
            
            // Add remaining results that aren't already included
            const remainingResults = combinedResults.filter(r => !includedIds.has(r.id));
            mixedResults.push(...remainingResults.slice(0, remainingSlots));
          }
          
          // Resort the mixed results by score
          mixedResults.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
          
          log.debug(`Created mixed result set with ${mixedResults.length} results`);
          return mixedResults;
        }
      }
      
      // Default case: just take the top results by score
      const limitedResults = combinedResults.slice(0, totalLimit);
      log.debug(`Returning ${limitedResults.length} combined results from ${combinedResults.length} total (sorted by relevance)`);
      return limitedResults;
    }
    
    log.debug(`No search results to return`);
    return [];
  }

  public static async searchOmniBase(
    indexName: string,
    query: string,
    namespace?: string,
    options?: { limit?: number }
  ) {
    try {
      log.debug(`OMNIBase search: index=${indexName}, query="${query.substring(0, 50)}..."`);
      
      // Get or create the LlamaCloud index
      const index = await this.getLlamaCloudIndex(indexName);
      if (!index) {
        log.error('Failed to initialize Cloud index - check LLAMA_CLOUD_API_KEY');
        return [];
      }
      
      log.debug('Successfully initialized OMNIBase index');

      // Configure the retriever - use correct property names
      const retriever = index.asRetriever({
        similarityTopK: options?.limit || 6,
        sparse_similarity_top_k: options?.limit || 6,
        k: options?.limit || 6,
        alpha: 0.5,
        enable_reranking: true,
        rerank_top_n: options?.limit || 6,
        retrieval_mode: 'chunks',

      });
      
      log.debug(`Executing OMNIBase query with topK=${options?.limit || 6}`);
      
      // Execute the query
      let nodes;
      try {
        // Make the actual API call to LlamaCloud
        nodes = await retriever.retrieve({ query });
        log.debug('OMNIBase query executed successfully');
      } catch (err) {
        log.error('Error executing OMNIBase query:', err);
        return [];
      }

      // Check if the result has matches
      if (!nodes || !Array.isArray(nodes)) {
        log.error('Unexpected response format from OMNIBase search:', nodes);
        return [];
      }

      log.debug(`OMNIBase search returned ${nodes.length} nodes`);
      
      // Log the first node to debug the structure
      if (nodes.length > 0) {
        const firstNode = nodes[0];
        log.debug(`First node score: ${firstNode.score}`);
        log.debug(`First node properties: ${Object.keys(firstNode).join(', ')}`);
        
        // Dump the entire first node for debugging
        try {
          log.debug(`First node structure: ${JSON.stringify(firstNode, null, 2).substring(0, 1000)}...`);
        } catch (e) {
          log.debug('Could not stringify first node');
        }
        
        // Check different possible content properties
        if (firstNode.node) {
          log.debug(`Node has 'node' property with keys: ${Object.keys(firstNode.node).join(', ')}`);
        }
        
        // Check for sourceNode property which is common in LlamaCloud
        if (firstNode.sourceNode) {
          log.debug(`Node has 'sourceNode' property with keys: ${Object.keys(firstNode.sourceNode).join(', ')}`);
        }
      }
      
      // Format the results
      const formattedResults = nodes.map((node: any, index: number) => {
        // Use node ID or generate a random ID if not available
        const id = node.id || node.node?.id || randomId();
        // Create a consistent collection ID format for all OMNIBase results
        const collectionId = `omnibase:${indexName}`;
        // Use fileId from metadata or assign a stable value
        const fileId = 'omnibase-external';
        
        // Extract content from node - check multiple possible properties
        let content = '';
        
        // Try different possible content locations
        if (node.text) {
          content = node.text;
        } else if (node.content) {
          content = node.content;
        } else if (node.node?.text) {
          content = node.node.text;
        } else if (node.node?.content) {
          content = node.node.content;
        } else if (node.sourceNode?.text) {
          content = node.sourceNode.text;
        } else if (node.sourceNode?.content) {
          content = node.sourceNode.content;
        } else if (node.sourceNode?.pageContent) {
          content = node.sourceNode.pageContent;
        } else if (node.node?.metadata?.text) {
          content = node.node.metadata.text;
        } else if (node.metadata?.text) {
          content = node.metadata.text;
        } else if (node.page_content) {
          content = node.page_content;
        } else if (node.pageContent) {
          content = node.pageContent;
        }
        
        // If still no content, try to find it in any property that looks like text
        if (!content && node) {
          // Recursively look for text content in the node
          const findTextContent = (obj: any, depth = 0): string => {
            if (!obj || depth > 3) return ''; // Limit recursion depth
            if (typeof obj === 'string' && obj.length > 10) return obj;
            
            if (typeof obj === 'object') {
              for (const key of Object.keys(obj)) {
                // Look for promising property names
                if (['text', 'content', 'value', 'passage', 'raw_text', 'chunk'].includes(key.toLowerCase())) {
                  if (typeof obj[key] === 'string' && obj[key].length > 10) {
                  return obj[key];
                  }
                }
                
                // If it's an object or array, check recursively
                if (obj[key] && typeof obj[key] === 'object') {
                  const foundContent = findTextContent(obj[key], depth + 1);
                  if (foundContent) return foundContent;
                }
              }
            }
              return '';
            };
            
          content = findTextContent(node);
            if (content) {
            log.debug(`Found content through recursive search for node ${index + 1}`);
          }
        }
        
        // If still no content, log the node structure and use a fallback message
        if (!content) {
          log.warn(`No content found for node ${index + 1} with ID ${id}`);
          log.debug(`Node structure: ${JSON.stringify(node, null, 2).substring(0, 500)}...`);
          content = `[No content available for chunk ${index + 1}]`;
        }
        
        // Log content for debugging
        log.debug(`Result ${index + 1} has contentLength: ${content.length} chars`);
        
        return {
          id,
          collectionId,
          fileId,
          content,
          score: node.score || 0.0,
        };
      });
      
      log.debug(`Formatted ${formattedResults.length} OMNIBase results`);
      return formattedResults;
    } catch (err: any) {
      captureException(err);
      log.error('Error in searchOmniBase:', err);
      return [];
    }
  }

  public static async getLlamaCloudIndex(indexName: string): Promise<any | null> {
    try {
      // Check if we already have this index cached
      if (this.llamaCloudIndexes[indexName]) {
        return this.llamaCloudIndexes[indexName];
      }
      
      // Use API key from environment or hardcoded for development
      const apiKey = process.env.LLAMA_CLOUD_API_KEY || '';
      
      log.debug(`Initializing OMNIBase index: ${indexName}`);
        
      // Use dynamic import for LlamaIndex
      try {
        const { LlamaCloudIndex } = await import('llamaindex');
        
        // Create new LlamaCloud index
        const index = new LlamaCloudIndex({
          name: indexName,
          projectName: "Default",
          organizationId: "",
          apiKey,
        });
        
        // Cache the index for future use
        this.llamaCloudIndexes[indexName] = index;
        
        log.debug(`OMNIBase index initialized: ${indexName}`);
        return index;
      } catch (importErr: any) {
        log.error(`Failed to import OMNIBaseIndex: ${importErr.message}`);
        return null;
      }
      } catch (err: any) {
      log.error(`Failed to initialize OMNIBase index: ${indexName}`, err);
        captureException(err);
        return null;
      }
  }

  public static async testOmniBaseConnection(indexName: string = 'test-index', namespace?: string) {
    try {
      log.debug(`Testing OMNIBase connection with index=${indexName}`);
      
      // Get LlamaCloud index
      const index = await this.getLlamaCloudIndex(indexName);
      if (!index) {
        const errorMsg = 'OMNIBase index not initialized. Please check your LLAMA_CLOUD_API_KEY.';
        log.error(errorMsg);
        return { success: false, message: errorMsg };
      }

      log.debug('Successfully initialized OMNIBase index');

      // Create a test retriever to verify connectivity - use correct property names
      const retriever = index.asRetriever({
        similarityTopK: 1,
        enable_reranking: true,
      });
      
      // Try a simple query to test connection
      try {
        log.debug(`Testing retriever with a simple query`);
        const testResult = await retriever.retrieve({ query: "test query for connection check" });
        
        log.debug(`Test query succeeded with ${testResult?.length || 0} results`);
      } catch (err) {
        const errorMsg = `Error testing OMNIBase index: ${(err as Error).message}`;
        log.error(errorMsg);
        return { success: false, message: errorMsg };
      }

      // If we reach here, the connection was successful
      return { 
        success: true, 
        message: `Successfully connected to OMNIBase index "${indexName}"` 
      };
    } catch (err: any) {
      captureException(err);
      log.error('Error testing OMNIBase connection:', err);
      return { success: false, message: err.message || String(err) };
    }
  }

  public static async createOmniBaseCollection(name: string, indexName: string, namespace?: string) {
    try {
      // Test connection first
      const testResult = await this.testOmniBaseConnection(indexName);
      if (!testResult.success) {
        return { success: false, message: testResult.message };
      }

      // Create a consistent, unique ID format for OMNIBase collections
      // Always prefix with "omnibase:" to clearly distinguish from local collections
      const collectionId = `omnibase:${indexName}`;
      
      // Insert the new collection into the database as an omnibase type
      const nowUnix = Math.floor(Date.now() / 1000);
      const collectionData = {
        id: collectionId,
        name,
        type: 'omnibase',
        indexName,
        namespace: null, // Namespace is no longer used with LlamaCloud
        createdAt: nowUnix,
        updatedAt: nowUnix,
        numOfFiles: 0 // Add this to match expected collection structure
      };

      // Return the collection data with success flag
      return { 
        success: true, 
        collection: collectionData,
        message: `Successfully created OMNIBase collection "${name}" with index "${indexName}"` 
      };
    } catch (err: any) {
      captureException(err);
      log.error('Error creating OMNIBase collection:', err);
      return { 
        success: false, 
        message: `Error creating OMNIBase collection: ${err.message}` 
      };
    }
  }

  // Helper method to get collection information
  private static async getCollectionsInfo(collectionIds: string[]): Promise<any[]> {
    if (!collectionIds || collectionIds.length === 0) {
      return [];
    }
    
    try {
      // Use better-sqlite3 instead of sqlite3
      let Database;
      try {
        Database = require('better-sqlite3');
      } catch (sqliteErr) {
        log.error('Error loading better-sqlite3 module:', sqliteErr);
        // Return empty array if better-sqlite3 is not available
        return [];
      }
      
      const dbPath = path.join(app.getPath('userData'), 'data.db');
      
      // Check if database file exists
      if (!require('fs').existsSync(dbPath)) {
        log.warn(`Database file not found at ${dbPath}`);
        return [];
      }
      
      const db = new Database(dbPath);
      
      // Query using better-sqlite3 syntax
      try {
        const sql = `
          SELECT id, name, type, indexName, namespace 
          FROM knowledge_collections 
          WHERE id IN (${collectionIds.map(() => '?').join(',')})
        `;
        
        const result = db.prepare(sql).all(collectionIds);
        db.close();
        return result;
      } catch (err) {
        log.error('Database query error:', err);
        db.close();
        return [];
      }
    } catch (err) {
      log.error('Error getting collection info:', err);
      return [];
    }
  }

  // Get SQLite database for checking knowledge_files table
  public static getDb() {
    try {
      // Import better-sqlite3 
      const Database = require('better-sqlite3');
      const dbPath = path.join(app.getPath('userData'), 'omnios.db');
      
      // Check if database file exists
      if (require('fs').existsSync(dbPath)) {
        const db = new Database(dbPath);
        
        // Add wrapper methods to match expected API
        return {
          get: (sql: string, params: any) => {
            try {
              return db.prepare(sql).get(params);
            } catch (error) {
              log.error('Error in db.get:', error);
              return null;
            }
          },
          
          all: (sql: string, params: any) => {
            try {
              return db.prepare(sql).all(params);
            } catch (error) {
              log.error('Error in db.all:', error);
              return [];
            }
          },
          
          close: () => {
            try {
              db.close();
            } catch (error) {
              log.error('Error closing database:', error);
            }
          }
        };
      }
      return null;
    } catch (error) {
      log.error('Error getting SQLite database:', error);
      return null;
    }
  }
}
