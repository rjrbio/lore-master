import { useEffect, useMemo, useState } from 'react';
import { getApiError, queryDocuments } from '../services/loreApi';
import type { ChatMessage, QuerySource } from '../types/lore';

const STORAGE_KEY = 'loremaster:chat:history';
const MAX_STORED_MESSAGES = 200;

function buildMessage(role: ChatMessage['role'], content: string, sources?: QuerySource[]): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    timestamp: new Date().toLocaleTimeString(),
    sources,
  };
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: ChatMessage[]): void {
  try {
    const trimmed = msgs.length > MAX_STORED_MESSAGES ? msgs.slice(-MAX_STORED_MESSAGES) : msgs;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // storage lleno o no disponible, se ignora
  }
}

export function useLoreChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => question.trim().length > 0 && !isLoading, [question, isLoading]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  function clearHistory() {
    setMessages([]);
  }

  async function sendQuestion() {
    const trimmed = question.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);
    setQuestion('');

    // Snapshot del historial antes de añadir el nuevo mensaje
    const historyToSend = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, buildMessage('user', trimmed)]);

    try {
      const response = await queryDocuments(trimmed, historyToSend);
      const answer = response.answer?.trim() || 'No encontré una respuesta fiable en el contexto disponible.';
      setMessages((prev) => [...prev, buildMessage('assistant', answer, response.sources)]);
    } catch (err) {
      const message = getApiError(err, 'No pude consultar la base documental');
      setError(message);
      setMessages((prev) => [...prev, buildMessage('assistant', 'No pude recuperar contenido de la base documental. Intenta de nuevo en unos segundos.')]);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    messages,
    question,
    setQuestion,
    isLoading,
    error,
    canSend,
    sendQuestion,
    clearHistory,
  };
}
