import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { queryDocumentsStream } from '../services/loreApi';
import type { AskStreamEvent, ChatMessage, QuerySource } from '../types/lore';

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

  const abortRef = useRef<AbortController | null>(null);

  const sendQuestion = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    setIsLoading(true);
    setQuestion('');

    const historyToSend = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, buildMessage('user', trimmed)]);

    const assistantId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    let accumulatedContent = '';
    let sources: QuerySource[] | undefined;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await queryDocumentsStream(
        trimmed,
        historyToSend,
        (event: AskStreamEvent) => {
          switch (event.type) {
            case 'delta':
              accumulatedContent += event.content;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: accumulatedContent } : m)),
              );
              break;
            case 'sources':
              sources = event.sources;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, sources } : m)),
              );
              break;
            case 'error':
              setError(event.message);
              break;
          }
        },
        controller.signal,
      );

      if (!accumulatedContent.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'No encontré una respuesta fiable en el contexto disponible.' }
              : m,
          ),
        );
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const fallback = err instanceof Error ? err.message : 'No pude consultar la base documental';
        setError(fallback);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content
              ? { ...m, content: 'No pude recuperar contenido de la base documental. Intenta de nuevo en unos segundos.' }
              : m,
          ),
        );
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [question, isLoading, messages]);

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
