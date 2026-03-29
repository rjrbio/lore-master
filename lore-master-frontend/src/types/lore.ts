export type ChatRole = 'user' | 'assistant';

export interface QuerySource {
  title: string;
  sourceUrl?: string;
  sourceType?: string;
  score?: number;
  preview?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  sources?: QuerySource[];
}

export interface AskRequest {
  question: string;
  history?: Array<{ role: ChatRole; content: string }>;
}

export interface AskResponse {
  answer: string;
  sources?: QuerySource[];
}

export type AskStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'sources'; sources: QuerySource[] }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface IngestFailure {
  index: number;
  reason: string;
  preview?: string;
}

export interface IngestSourceResult {
  url: string;
  message: string;
  title: string;
  preview: string;
  sourceUrl: string;
  sourceType: 'web' | 'fandom' | 'wikipedia' | 'file';
  locale: string;
  extractionMode: 'jina' | 'api' | 'html';
  replaceExisting: boolean;
  replacedChunks: number;
  totalChunks: number;
  savedChunks: number;
  duplicateChunks: number;
  droppedChunks: number;
  tags: string[];
  duplicateDetails: IngestFailure[];
  failedChunks: IngestFailure[];
}

export interface IngestBatchResponse {
  message: string;
  processedUrls: number;
  successfulUrls: number;
  failedUrls: number;
  results: IngestSourceResult[];
  failures: Array<{ url: string; reason: string }>;
}
