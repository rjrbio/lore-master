export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

export interface AskResponse {
  answer: string;
  sources?: string[];
}

export interface IngestFailure {
  index: number;
  reason: string;
  preview?: string;
}

export interface IngestResponse {
  message: string;
  title: string;
  preview: string;
  sourceUrl: string;
  locale: string;
  extractionMode: 'jina' | 'api' | 'html';
  replaceExisting: boolean;
  replacedChunks: number;
  totalChunks: number;
  savedChunks: number;
  duplicateChunks: number;
  droppedChunks: number;
  duplicateDetails: IngestFailure[];
  failedChunks: IngestFailure[];
}
