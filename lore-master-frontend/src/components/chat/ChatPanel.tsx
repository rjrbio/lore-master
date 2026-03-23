import { type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
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
    <section className="glass-panel" aria-label="Consulta documental">
      <header className="mb-6 grid gap-2 lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-end">
        <div className="grid gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cobalt/85">Consulta RAG</p>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">Consulta documental</h2>
        </div>
        <p className="max-w-3xl text-sm leading-7 text-slate-300/78 md:text-[15px]">Pregunta sobre el contenido indexado. Las respuestas se construyen con contexto recuperado desde MongoDB Atlas Vector Search.</p>
      </header>

      <div className="grid max-h-[44vh] min-h-[240px] gap-4 overflow-y-auto pr-2" role="log" aria-live="polite">
        {!hasMessages && (
          <div className="grid min-h-[240px] place-content-center gap-2 border-l border-slate-200/10 pl-6 text-left">
            <p className="font-display text-xl text-slate-100">No hay consultas todavía</p>
            <p className="text-sm leading-7 text-slate-400">Empieza con una pregunta como: "¿Qué resume este artículo?"</p>
          </div>
        )}

        {messages.map((msg) => (
          <article
            key={msg.id}
            className={`grid max-w-[min(100%,76rem)] gap-2 px-0 py-1 ${
              msg.role === 'user'
                ? 'ml-auto border-l-2 border-cobalt/80 pl-5 text-white'
                : 'mr-auto border-l border-slate-400/30 pl-5 text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <span>{msg.role === 'user' ? 'Usuario' : 'Asistente'}</span>
              <time>{msg.timestamp}</time>
            </div>

            {msg.role === 'assistant' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  h1: ({ ...props }) => <h1 className="mb-3 mt-1 font-display text-2xl font-semibold tracking-tight text-white" {...props} />,
                  h2: ({ ...props }) => <h2 className="mb-3 mt-1 font-display text-xl font-semibold tracking-tight text-white" {...props} />,
                  h3: ({ ...props }) => <h3 className="mb-2 mt-1 font-display text-lg font-semibold tracking-tight text-white" {...props} />,
                  p: ({ ...props }) => <p className="mb-3 last:mb-0 text-[15px] leading-8 text-slate-100/92 md:text-[16px]" {...props} />,
                  strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                  ul: ({ ...props }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[15px]" {...props} />,
                  ol: ({ ...props }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-[15px]" {...props} />,
                  li: ({ ...props }) => <li className="leading-7 text-slate-100/92" {...props} />,
                  a: ({ ...props }) => <a className="text-cobalt underline decoration-cobalt/70 underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
                  blockquote: ({ ...props }) => (
                    <blockquote className="mb-3 border-l-2 border-violet/70 pl-4 text-[15px] italic text-slate-300" {...props} />
                  ),
                  table: ({ ...props }) => <table className="mb-4 w-full border-collapse text-sm" {...props} />,
                  th: ({ ...props }) => <th className="border-b border-slate-300/20 px-2 py-2 text-left font-semibold text-slate-200" {...props} />,
                  td: ({ ...props }) => <td className="border-b border-slate-300/10 px-2 py-2 text-slate-300" {...props} />,
                  code: ({ className, children, ...props }) => {
                    const isBlock = className?.includes('language-');
                    if (isBlock) {
                      return (
                        <code
                          className={`${className ?? ''} block overflow-x-auto border-l-2 border-cobalt/50 bg-[#0b1220]/90 px-4 py-3 text-xs leading-6 text-slate-100`}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }

                    return (
                      <code className="rounded-sm bg-slate-900/55 px-1.5 py-0.5 text-xs text-cobalt" {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ ...props }) => <pre className="mb-3 overflow-x-auto" {...props} />,
                  hr: ({ ...props }) => <hr className="my-5 border-slate-200/10" {...props} />,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : (
              <p className="text-[15px] leading-8 text-slate-100/95">{msg.content}</p>
            )}

            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.sources.map((source) => (
                  <span key={`${source.title}-${source.sourceUrl ?? 'none'}`} className="chip transition hover:border-cobalt/40 hover:text-slate-100">
                    {source.title}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}

        {isLoading && (
          <div className="mx-auto mt-1 flex w-16 justify-center gap-2" aria-label="Cargando respuesta">
            <span className="h-2 w-2 rounded-full bg-cobalt animate-pulseY" />
            <span className="h-2 w-2 rounded-full bg-violet animate-pulseY [animation-delay:0.2s]" />
            <span className="h-2 w-2 rounded-full bg-cobalt animate-pulseY [animation-delay:0.4s]" />
          </div>
        )}
      </div>

      {error && <p className="mt-5 border-l-2 border-rose-400 pl-4 text-sm leading-7 text-rose-200">{error}</p>}

      <div className="mt-5 grid gap-3 border-t border-slate-200/10 pt-4 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm text-slate-300">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pregunta</span>
          <input
            className="glass-input"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            onKeyDown={onEnterPress}
            placeholder="Escribe una pregunta sobre tus documentos..."
            aria-label="Pregunta documental"
          />
        </label>
        <button className="neon-button md:min-w-44" onClick={onAsk} disabled={!canSend}>
          {isLoading ? 'Consultando...' : 'Preguntar'}
        </button>
      </div>
    </section>
  );
}
