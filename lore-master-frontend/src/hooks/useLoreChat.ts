import { useMemo, useState } from 'react';
import { askLore, getApiError } from '../services/loreApi';
import type { ChatMessage } from '../types/lore';

function buildMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    timestamp: new Date().toLocaleTimeString(),
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
      const response = await askLore(trimmed);
      const answer = response.answer?.trim() || 'No encontré una respuesta fiable en el contexto disponible.';
      setMessages((prev) => [...prev, buildMessage('assistant', answer)]);
    } catch (err) {
      const message = getApiError(err, 'No pude consultar al Erudito');
      setError(message);
      setMessages((prev) => [...prev, buildMessage('assistant', 'No logré abrir las crónicas. Intenta de nuevo en unos segundos.')]);
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
