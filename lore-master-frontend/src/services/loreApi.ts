import axios from 'axios';
import type { AskResponse, DocumentListItem, IngestBatchResponse } from '../types/lore';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const api = axios.create({
  baseURL,
  timeout: 30000,
});

export async function queryDocuments(question: string): Promise<AskResponse> {
  const { data } = await api.get<AskResponse>('/documents/query', {
    params: { q: question, _ts: Date.now() },
  });
  return data;
}

export async function ingestDocuments(urls: string[], replaceExisting: boolean, tags: string[]): Promise<IngestBatchResponse> {
  const { data } = await api.post<IngestBatchResponse>('/documents/ingest', {
    urls,
    replaceExisting,
    tags,
  });
  return data;
}

  export async function ingestFiles(files: File[], replaceExisting: boolean, tags: string[]): Promise<IngestBatchResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('replaceExisting', String(replaceExisting));
    formData.append('tags', tags.join(','));

    const { data } = await api.post<IngestBatchResponse>('/documents/ingest-files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

export async function listDocuments(): Promise<DocumentListItem[]> {
  const { data } = await api.get<DocumentListItem[]>('/documents', {
    params: { _ts: Date.now() },
  });
  return data;
}

export function getApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const backendMessage = error.response?.data?.message;
    if (typeof backendMessage === 'string') {
      return backendMessage;
    }

    if (Array.isArray(backendMessage) && backendMessage.length > 0) {
      return String(backendMessage[0]);
    }

    if (error.response?.status) {
      return `${fallback} (HTTP ${error.response.status})`;
    }
  }

  if (error instanceof Error && error.message) {
    return `${fallback}: ${error.message}`;
  }

  return fallback;
}
