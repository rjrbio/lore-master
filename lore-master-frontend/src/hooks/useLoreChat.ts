import { useMemo, useState } from 'react';
import { getApiError, queryDocuments } from '../services/loreApi';
import type { ChatMessage, QuerySource } from '../types/lore';

function buildMessage(role: ChatMessage['role'], content: string, sources?: QuerySource[]): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    timestamp: new Date().toLocaleTimeString(),
    sources,
  };
}

export function useLoreChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => question.trim().length > 0 && !isLoading, [question, isLoading]);

  async function sendQuestion() {
    const trimmed = question.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);
    setQuestion('');
    setMessages((prev) => [...prev, buildMessage('user', trimmed)]);

    try {
      const response = await queryDocuments(trimmed);
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
  };
}
