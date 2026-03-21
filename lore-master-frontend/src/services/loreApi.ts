import axios from 'axios';
import type { AskResponse, IngestResponse } from '../types/lore';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const api = axios.create({
  baseURL,
  timeout: 30000,
});

export async function askLore(question: string): Promise<AskResponse> {
  const { data } = await api.get<AskResponse>('/lore/ask', {
    params: { q: question, _ts: Date.now() },
  });
  return data;
}

export async function ingestLore(url: string, category: string, replaceExisting: boolean): Promise<IngestResponse> {
  const { data } = await api.post<IngestResponse>('/lore/ingest', {
    url,
    category,
    replaceExisting,
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
