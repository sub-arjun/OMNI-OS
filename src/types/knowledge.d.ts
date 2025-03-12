export interface ICollection {
  id: string;
  name: string;
  memo?: string;
  numOfFiles?: number;
  favorite?: boolean;
  pinedAt?: number|null;
  createdAt: number;
  updatedAt: number;
  type?: 'local' | 'omnibase'; // Type of collection - local (LanceDB) or omnibase (Pinecone)
  indexName?: string; // For omnibase collections
  namespace?: string; // For omnibase collections
}

export interface ICollectionFile {
  id: string;
  collectionId: string;
  name: string;
  size: number;
  numOfChunks?: number;
  createdAt: number;
  updatedAt: number;
}

export interface IKnowledgeChunk {
  id: string;
  collectionId: string;
  fileId: string;
  content: string;
  score?: number; // Relevance score, used for ranking
}

export interface IOmniBaseConnection {
  id: string;
  name: string;
  indexName: string;
  namespace?: string;
  isConnected: boolean;
  createdAt: number;
  updatedAt: number;
}
