/* eslint-disable no-console */
import Database, { Statement } from 'better-sqlite3';
import { app, ipcMain } from 'electron';
import * as logging from './logging';
import path from 'path';
import { isOneDimensionalArray } from '../utils/util';

const dbPath = path.join(app.getPath('userData'), 'omnios.db');
const database = new Database(dbPath);

function createTableChats() {
  database
    .prepare(
      `
  CREATE TABLE IF NOT EXISTS "chats" (
    "id" text(31) NOT NULL,
    "summary" text,
    "model" text,
    "systemMessage" text,
    "temperature" real,
    "maxTokens" integer,
    "stream" integer(1) DEFAULT 1,
    "context" text,
    "maxCtxMessages" integer DEFAULT 5,
    "prompt" TEXT,
    "input" TEXT,
    "createdAt" integer,
    "folderId" text(31) NULL,
    PRIMARY KEY ("id")
  )`,
    )
    .run();
}

function createTableMessages() {
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "messages" (
      "id" text(31) NOT NULL,
      "prompt" TEXT COLLATE NOCASE,
      "reply" TEXT COLLATE NOCASE,
      "reasoning" TEXT,
      "inputTokens" integer,
      "outputTokens" integer,
      "chatId" real(31),
      "temperature" real,
      "model" text,
      "memo" text,
      "createdAt" integer,
      "isActive" integer(1),
      "citedFiles"	TEXT,
      "citedChunks"	TEXT,
      "maxTokens" INTEGER,
      PRIMARY KEY ("id"),
      CONSTRAINT "fk_messages_chats" FOREIGN KEY ("chatId") REFERENCES "chats" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    )
    .run();
}

function createTableBookmarks() {
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "bookmarks" (
    "id" text(31) NOT NULL,
    "msgId" text NOT NULL,
    "prompt" TEXT,
    "reply" TEXT,
    "reasoning" TEXT,
    "temperature" real,
    "model" text,
    "memo" text,
    "favorite" integer(1) DEFAULT 0,
    "citedFiles"	TEXT,
    "citedChunks"	TEXT,
    "createdAt" integer,
    PRIMARY KEY ("id"),
    CONSTRAINT "uix_msg_id" UNIQUE ("msgId" COLLATE BINARY ASC)
  )`,
    )
    .run();
}

function createTablePrompts() {
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "prompts" (
    "id" text(31) NOT NULL,
    "name" text,
    "systemMessage" TEXT,
    "userMessage" text,
    "systemVariables" text,
    "userVariables" text,
    "models" text,
    "temperature" real,
    "maxTokens" integer,
    "createdAt" integer,
    "updatedAt" integer,
    "pinedAt" integer DEFAULT NULL,
    PRIMARY KEY ("id")
  )`,
    )
    .run();
}

function createTableUsages() {
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "usages" (
    "id" text(31),
    "provider" text,
    "model" text,
    "InputTokens" integer,
    "outputTokens" integer,
    "inputPrice" number,
    "outputPrice" NUMBER,
    "createdAt" integer,
    PRIMARY KEY ("id")
  )`,
    )
    .run();
}

function createTableKnowledgeCollections() {
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "knowledge_collections" (
     "id" text(31) NOT NULL,
     "name" varchar NOT NULL,
     "memo" text,
     "pinedAt" integer,
     "favorite" integer(1),
     "createdAt" integer NOT NULL,
     "updatedAt" integer NOT NULL,
     "type" text,
     "indexName" text,
     "namespace" text,
     PRIMARY KEY (id));`,
    )
    .run();
}

function createTableKnowledgeFiles() {
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "knowledge_files" (
    "id" text(31) NOT NULL,
    "collectionId" text(31) NOT NULL,
    "name" varchar NOT NULL,
    "size" integer,
    "numOfChunks" integer,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (collectionId)
        REFERENCES knowledge_collections(id)
        ON DELETE CASCADE
    );`,
    )
    .run();
}

function createTableChatKnowledgeRels() {
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "chat_knowledge_rels" (
	"id" text NOT NULL,
	"chatId" text NOT NULL,
	"collectionId" text NOT NULL,
	FOREIGN KEY("chatId") REFERENCES "chats"("id") ON DELETE CASCADE,
	FOREIGN KEY("collectionId") REFERENCES "knowledge_collections"("id") ON DELETE CASCADE,
	PRIMARY KEY (id)
)`,
    )
    .run();
}

function createTableChatFolders() {
  database
    .prepare(
      `CREATE TABLE IF NOT EXISTS "chat_folders" (
      "id" text(31) NOT NULL,
      "name" text NOT NULL,
      "createdAt" integer,
      PRIMARY KEY ("id")
    )`,
    )
    .run();
}

function alertTableChats() {
  const columns = database.prepare(`PRAGMA table_info(chats)`).all();
  const hasPromptColumn = columns.some(
    (column: any) => column.name === 'prompt',
  );
  if (!hasPromptColumn) {
    database.prepare(`ALTER TABLE chats ADD COLUMN prompt TEXT`).run();
    logging.debug('Added [prompt] column to [chats] table');
  } else {
    logging.debug('[prompt】 column already exists in [chats] table');
  }
  const hasInputColumn = columns.some((column: any) => column.name === 'input');
  if (!hasInputColumn) {
    database.prepare(`ALTER TABLE chats ADD COLUMN input TEXT`).run();
    logging.debug('Added [input] column to [chats] table');
  } else {
    logging.debug('[input] column already exists in [chats] table');
  }
}

function alertTableMessages() {
  const columns = database.prepare(`PRAGMA table_info(messages)`).all();
  const hasReasoningColumn = columns.some(
    (column: any) => column.name === 'reasoning',
  );
  if (!hasReasoningColumn) {
    database.prepare(`ALTER TABLE messages ADD COLUMN reasoning TEXT`).run();
    logging.debug('Added [reasoning] column to  [messages] table');
  } else {
    logging.debug('[reasoning] column already exists in [Messages] table');
  }
}

function alertTableBookmarks() {
  const columns = database.prepare(`PRAGMA table_info(bookmarks)`).all();
  const hasReasoningColumn = columns.some(
    (column: any) => column.name === 'reasoning',
  );
  if (!hasReasoningColumn) {
    database.prepare(`ALTER TABLE bookmarks ADD COLUMN reasoning TEXT`).run();
    logging.debug('Added [reasoning] column to [bookmarks] table');
  } else {
    logging.debug('[reasoning] column already exists in [bookmarks] table');
  }
}

// Add citations column to messages table
function alertTableMessagesCitations() {
  const columns = database.prepare(`PRAGMA table_info(messages)`).all();
  const hasCitationsColumn = columns.some(
    (column: any) => column.name === 'citations',
  );
  if (!hasCitationsColumn) {
    database.prepare(`ALTER TABLE messages ADD COLUMN citations TEXT`).run();
    logging.debug('Added [citations] column to [messages] table');
  } else {
    logging.debug('[citations] column already exists in [messages] table');
  }
}

// Add alter table functions for OMNIBase columns
function alterTableKnowledgeCollectionsAddOMNIBase() {
  try {
    // Check if type column exists
    const columns = database
      .prepare('PRAGMA table_info(knowledge_collections)')
      .all();
    
    const columnNames = columns.map((col: any) => col.name);
    
    if (!columnNames.includes('type')) {
      database
        .prepare(
          `ALTER TABLE knowledge_collections ADD COLUMN type text;`
        )
        .run();
    }
    
    if (!columnNames.includes('indexName')) {
      database
        .prepare(
          `ALTER TABLE knowledge_collections ADD COLUMN indexName text;`
        )
        .run();
    }
    
    if (!columnNames.includes('namespace')) {
      database
        .prepare(
          `ALTER TABLE knowledge_collections ADD COLUMN namespace text;`
        )
        .run();
    }
  } catch (error) {
    console.error('Error altering knowledge_collections table:', error);
  }
}

function alterTableChatsAddFolderId() {
  const columns = database.prepare(`PRAGMA table_info(chats)`).all();
  const hasFolderIdColumn = columns.some(
    (column: any) => column.name === 'folderId',
  );
  if (!hasFolderIdColumn) {
    database.prepare(`ALTER TABLE chats ADD COLUMN folderId TEXT`).run();
    logging.debug('Added [folderId] column to [chats] table');
  } else {
    logging.debug('[folderId] column already exists in [chats] table');
  }
}

const initDatabase = database.transaction(() => {
  logging.debug('Init database...');

  database.pragma('foreign_keys = ON');
  createTableChats();
  createTableMessages();
  createTableBookmarks();
  createTablePrompts();
  createTableUsages();
  createTableKnowledgeCollections();
  createTableKnowledgeFiles();
  createTableChatKnowledgeRels();
  createTableChatFolders();
  // v0.9.6
  alertTableChats();
  // v.0.9.7
  alertTableMessages();
  alertTableBookmarks();
  // Add citations column
  alertTableMessagesCitations();
  // Add OMNIBase columns
  alterTableKnowledgeCollectionsAddOMNIBase();
  // Add folder support
  alterTableChatsAddFolderId();
  logging.info('Database initialized.');
});

database.pragma('journal_mode = WAL'); // performance reason
initDatabase();

ipcMain.handle('db-all', (event, data) => {
  const { sql, params } = data;
  logging.debug('db-all', sql, params);
  try {
    // If params is null or undefined, call .all() without parameters
    if (params === null || params === undefined) {
      return database.prepare(sql).all();
    }
    return database.prepare(sql).all(params);
  } catch (err: any) {
    logging.captureException(err);
  }
});

ipcMain.handle('db-run', (_, data) => {
  const { sql, params } = data;
  logging.debug('db-run', sql, params);
  
  try {
    // Check if this is an INSERT operation for knowledge_files
    if (sql.trim().toUpperCase().startsWith('INSERT INTO KNOWLEDGE_FILES') && 
        params && 
        params.length > 0) {
      
      // Extract the ID from params (should be the first parameter for knowledge_files insertions)
      const fileId = params[0];
      
      // First check if a record with this ID already exists
      if (fileId) {
        try {
          const existingRecord = database
            .prepare('SELECT id FROM knowledge_files WHERE id = ?')
            .get(fileId);
            
          if (existingRecord) {
            logging.debug(`Prevented duplicate insertion - file with ID ${fileId} already exists`);
            // Return true to simulate successful operation since the record exists
            return true;
          }
        } catch (checkErr) {
          // If the check fails, proceed with normal insertion
          logging.debug(`Error checking for existing file: ${checkErr}`);
        }
      }
    }
    
    // Proceed with normal operation
    // If params is null or undefined, call .run() without parameters
    if (params === null || params === undefined) {
      database.prepare(sql).run();
    } else {
      database.prepare(sql).run(params);
    }
    return true;
  } catch (err: any) {
    logging.captureException(err);
    return false;
  }
});

ipcMain.handle('db-transaction', (_, data: any[]) => {
  logging.debug('db-transaction', JSON.stringify(data, null, 2));
  const tasks: { statement: Statement; params: any[]; skip?: boolean }[] = [];
  
  // Process each task and identify knowledge_files insertions
  for (const { sql, params } of data) {
    const isKnowledgeFileInsert = sql.trim().toUpperCase().startsWith('INSERT INTO KNOWLEDGE_FILES');
    let shouldSkip = false;
    
    // Check if we need to skip this operation due to existing record
    if (isKnowledgeFileInsert && params && params.length > 0) {
      // For knowledge_files inserts, check if record already exists
      let fileId;
      
      // Extract file ID based on parameter structure
      if (isOneDimensionalArray(params) && params.length > 0) {
        fileId = params[0]; // First param is ID in our schema
      } else if (Array.isArray(params) && params.length > 0 && Array.isArray(params[0]) && params[0].length > 0) {
        fileId = params[0][0]; // For batch inserts, first param of first batch is ID
      }
      
      if (fileId) {
        try {
          const existingRecord = database
            .prepare('SELECT id FROM knowledge_files WHERE id = ?')
            .get(fileId);
            
          if (existingRecord) {
            logging.debug(`Skipping transaction operation - file with ID ${fileId} already exists`);
            shouldSkip = true;
          }
        } catch (checkErr) {
          logging.debug(`Error checking for existing file in transaction: ${checkErr}`);
          // Continue with operation if check fails
        }
      }
    }
    
    tasks.push({
      statement: database.prepare(sql),
      params,
      skip: shouldSkip
    });
  }
  
  return new Promise((resolve) => {
    try {
      database.transaction(() => {
        for (const { statement, params, skip } of tasks) {
          // Skip operations marked to be skipped
          if (skip) continue;
          
          if (isOneDimensionalArray(params)) {
            statement.run(params);
          } else {
            for (const param of params) {
              statement.run(param);
            }
          }
        }
      })();
      resolve(true);
    } catch (err: any) {
      logging.captureException(err);
      resolve(false);
    }
  });
});

ipcMain.handle('db-get', (_, data) => {
  const { sql, id } = data;
  logging.debug('db-get', sql, id);
  try {
    // If id is null or undefined, call .get() without parameters
    if (id === null || id === undefined) {
      return database.prepare(sql).get();
    }
    return database.prepare(sql).get(id);
  } catch (err: any) {
    logging.captureException(err);
  }
});
