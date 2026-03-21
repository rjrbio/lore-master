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
    <section className="panel panel--chat" aria-label="Consulta documental">
      <header className="panel__header">
        <p className="panel__eyebrow">Consulta RAG</p>
        <h2>Consulta documental</h2>
        <p className="panel__subtitle">Pregunta sobre el contenido indexado. Las respuestas se construyen con contexto recuperado desde MongoDB Atlas Vector Search.</p>
      </header>

      <div className="chat-feed" role="log" aria-live="polite">
        {!hasMessages && (
          <div className="chat-empty">
            <p className="chat-empty__title">No hay consultas todavía</p>
            <p>Empieza con una pregunta como: "¿Qué resume este artículo?"</p>
          </div>
        )}

        {messages.map((msg) => (
          <article key={msg.id} className={`chat-message ${msg.role === 'user' ? 'chat-message--user' : 'chat-message--assistant'}`}>
            <div className="chat-message__meta">
              <span>{msg.role === 'user' ? 'Usuario' : 'Asistente'}</span>
              <time>{msg.timestamp}</time>
            </div>
            <p>{msg.content}</p>
            {msg.sources && msg.sources.length > 0 && (
              <div className="source-list">
                {msg.sources.map((source) => (
                  <span key={`${source.title}-${source.sourceUrl ?? 'none'}`} className="document-tag">
                    {source.title}
                  </span>
                ))}
              </div>
            )}
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
          placeholder="Escribe una pregunta sobre tus documentos..."
          aria-label="Pregunta documental"
        />
        <button onClick={onAsk} disabled={!canSend}>
          {isLoading ? 'Consultando...' : 'Preguntar'}
        </button>
      </div>
    </section>
  );
}
