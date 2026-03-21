import { type KeyboardEvent } from 'react';
import type { ChatMessage } from '../../types/lore';

interface ChatPanelProps {
  question: string;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  isLoading: boolean;
  canSend: boolean;
  error: string | null;
  messages: ChatMessage[];
}

export function ChatPanel({
  question,
  onQuestionChange,
  onAsk,
  isLoading,
  canSend,
  error,
  messages,
}: ChatPanelProps) {
  const hasMessages = messages.length > 0;

  const onEnterPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onAsk();
    }
  };

  return (
    <section className="panel panel--chat" aria-label="Consulta al Erudito">
      <header className="panel__header">
        <p className="panel__eyebrow">Oráculo RAG</p>
        <h2>Consulta al Erudito</h2>
        <p className="panel__subtitle">Pregunta por jefes, NPCs, objetos o historia. Las respuestas se construyen con contexto recuperado desde MongoDB Atlas Vector Search.</p>
      </header>

      <div className="chat-feed" role="log" aria-live="polite">
        {!hasMessages && (
          <div className="chat-empty">
            <p className="chat-empty__title">Tu mesa de estudio está vacía</p>
            <p>Empieza con una pregunta como: "¿Cuál es el origen de Malenia?"</p>
          </div>
        )}

        {messages.map((msg) => (
          <article key={msg.id} className={`chat-message ${msg.role === 'user' ? 'chat-message--user' : 'chat-message--assistant'}`}>
            <div className="chat-message__meta">
              <span>{msg.role === 'user' ? 'Tú' : 'Erudito'}</span>
              <time>{msg.timestamp}</time>
            </div>
            <p>{msg.content}</p>
          </article>
        ))}

        {isLoading && (
          <div className="chat-loading" aria-label="Cargando respuesta">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {error && <p className="feedback feedback--error">{error}</p>}

      <div className="ask-box">
        <input
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={onEnterPress}
          placeholder="Escribe tu pregunta..."
          aria-label="Pregunta para el Erudito"
        />
        <button onClick={onAsk} disabled={!canSend}>
          {isLoading ? 'Consultando...' : 'Preguntar'}
        </button>
      </div>
    </section>
  );
}
