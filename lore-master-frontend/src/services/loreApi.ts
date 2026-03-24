import axios from 'axios';
import type { AskRequest, AskResponse, IngestBatchResponse } from '../types/lore';

const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

const api = axios.create({
  baseURL,
  timeout: 60000,
});

// Retry automático para errores de red y 5xx
api.interceptors.response.use(undefined, async (error) => {
  const config = error.config;
  if (!config || config._retryCount >= 2) return Promise.reject(error);

  const shouldRetry =
    !error.response ||
    error.response.status >= 500 ||
    error.code === 'ECONNABORTED';

  if (!shouldRetry) return Promise.reject(error);

  config._retryCount = (config._retryCount || 0) + 1;
  const delay = config._retryCount * 1000;
  await new Promise((r) => setTimeout(r, delay));
  return api(config);
});

export async function queryDocuments(
  question: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<AskResponse> {
  const body: AskRequest = { question, history: history ?? [] };
  const { data } = await api.post<AskResponse>('/documents/query', body);
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

export async function ingestSingleUrl(url: string, replaceExisting: boolean, tags: string[]): Promise<IngestBatchResponse> {
  const { data } = await api.post<IngestBatchResponse>('/documents/ingest', {
    urls: [url],
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
