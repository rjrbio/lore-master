import type { DocumentListItem } from '../../types/lore';

interface DocumentsPanelProps {
  documents: DocumentListItem[];
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
}

export function DocumentsPanel({ documents, isLoading, error, onReload }: DocumentsPanelProps) {
  return (
    <section className="panel panel--documents" aria-label="Biblioteca documental">
      <header className="panel__header panel__header--inline">
        <div>
          <p className="panel__eyebrow">Biblioteca</p>
          <h2>Documentos indexados</h2>
          <p className="panel__subtitle">Consulta qué fuentes están disponibles y cuántos fragmentos aporta cada una.</p>
        </div>
        <button className="secondary-action" onClick={onReload} disabled={isLoading}>
          {isLoading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {error && <p className="feedback feedback--error">{error}</p>}

      {documents.length === 0 && !isLoading ? (
        <div className="documents-empty">
          <p className="chat-empty__title">Todavía no hay documentos cargados</p>
          <p>Ingiere una o varias fuentes para empezar a consultar conocimiento.</p>
        </div>
      ) : (
        <div className="documents-list">
          {documents.map((document) => (
            <article key={`${document.sourceUrl ?? document.title}-${document.lastUpdated ?? 'n/a'}`} className="document-card">
              <div className="document-card__head">
                <div>
                  <h3>{document.title}</h3>
                  <p>{document.sourceUrl ?? 'Fuente no disponible'}</p>
                </div>
                <span className="document-chip">{document.sourceType ?? 'web'}</span>
              </div>

              <dl className="document-meta">
                <div>
                  <dt>Chunks</dt>
                  <dd>{document.chunkCount}</dd>
                </div>
                <div>
                  <dt>Locale</dt>
                  <dd>{document.locale ?? 'und'}</dd>
                </div>
                <div>
                  <dt>Última actualización</dt>
                  <dd>{document.lastUpdated ? new Date(document.lastUpdated).toLocaleString() : 'Sin fecha'}</dd>
                </div>
              </dl>

              {document.tags.length > 0 && (
                <div className="tag-list">
                  {document.tags.map((tag) => (
                    <span key={tag} className="document-tag">{tag}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
