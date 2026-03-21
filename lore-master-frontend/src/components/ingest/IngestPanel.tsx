import type { IngestResponse } from '../../types/lore';

interface IngestPanelProps {
  url: string;
  category: string;
  replaceExisting: boolean;
  isLoading: boolean;
  canIngest: boolean;
  error: string | null;
  result: IngestResponse | null;
  onUrlChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onReplaceExistingChange: (value: boolean) => void;
  onIngest: () => void;
  onClear: () => void;
}

export function IngestPanel({
  url,
  category,
  replaceExisting,
  isLoading,
  canIngest,
  error,
  result,
  onUrlChange,
  onCategoryChange,
  onReplaceExistingChange,
  onIngest,
  onClear,
}: IngestPanelProps) {
  return (
    <section className="panel panel--ingest" aria-label="Ingesta de conocimiento">
      <header className="panel__header">
        <p className="panel__eyebrow">Pipeline de Ingesta</p>
        <h2>Alimentar Conocimiento</h2>
        <p className="panel__subtitle">Soporta URLs de Fandom multi-locale, por ejemplo en, es, fr, de, pt-br y más.</p>
      </header>

      <div className="ingest-form">
        <label>
          URL de Wiki
          <input
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://eldenring.fandom.com/es/wiki/..."
            aria-label="URL a ingerir"
          />
        </label>

        <label>
          Categoría
          <select value={category} onChange={(event) => onCategoryChange(event.target.value)} aria-label="Categoría de lore">
            <option value="Boss">Jefe (Boss)</option>
            <option value="NPC">Personaje (NPC)</option>
            <option value="Lore">Historia General</option>
            <option value="Item">Objeto</option>
          </select>
        </label>

        <label className="ingest-form__check">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(event) => onReplaceExistingChange(event.target.checked)}
            aria-label="Reemplazar contenido existente para esta URL"
          />
          Reemplazar contenido existente para esta URL
        </label>

        <button className="ingest-form__submit" onClick={onIngest} disabled={!canIngest}>
          {isLoading ? 'Procesando URL...' : 'Absorber conocimiento'}
        </button>
      </div>

      {(error || result) && (
        <div className={`ingest-status ${error ? 'ingest-status--error' : 'ingest-status--success'}`}>
          <div className="ingest-status__head">
            <strong>{error ? 'Ingesta fallida' : 'Ingesta completada'}</strong>
            <button onClick={onClear} aria-label="Limpiar estado">Cerrar</button>
          </div>

          {error && <p>{error}</p>}

          {result && (
            <>
              <p>{result.message}</p>
              <ul>
                <li>Título: {result.title}</li>
                <li>Locale detectado: {result.locale}</li>
                <li>Fuente de extracción: {result.extractionMode}</li>
                <li>Modo reemplazo: {result.replaceExisting ? 'Sí' : 'No'}</li>
                <li>Chunks reemplazados: {result.replacedChunks}</li>
                <li>Chunks guardados: {result.savedChunks}/{result.totalChunks}</li>
                <li>Chunks duplicados: {result.duplicateChunks}</li>
                <li>Chunks descartados: {result.droppedChunks}</li>
                <li>Origen: {result.sourceUrl}</li>
              </ul>
              {result.duplicateDetails.length > 0 && (
                <p>Reingesta detectada: {result.duplicateDetails.length} chunk(s) ya existían para esa URL.</p>
              )}
              {result.failedChunks.length > 0 && (
                <p>Fallos parciales: {result.failedChunks.length} chunk(s) no se guardaron.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
