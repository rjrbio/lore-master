import type { IngestBatchResponse } from '../../types/lore';
import type { FileUploadProgress } from '../../hooks/useLoreIngest';

interface IngestPanelProps {
  mode: 'urls' | 'files';
  onModeChange: (mode: 'urls' | 'files') => void;
  uploadedFiles: File[];
  fileValidationErrors: string[];
  fileProgress: FileUploadProgress[];
  onHandleFileSelect: (files: FileList | null) => void;
  urlsText: string;
  tagsText: string;
  replaceExisting: boolean;
  isLoading: boolean;
  canIngest: boolean;
  error: string | null;
  result: IngestBatchResponse | null;
  onUrlsChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onReplaceExistingChange: (value: boolean) => void;
  onIngest: () => void;
  onClear: () => void;
}

export function IngestPanel({
  mode,
  onModeChange,
  uploadedFiles,
  fileValidationErrors,
  fileProgress,
  onHandleFileSelect,
  urlsText,
  tagsText,
  replaceExisting,
  isLoading,
  canIngest,
  error,
  result,
  onUrlsChange,
  onTagsChange,
  onReplaceExistingChange,
  onIngest,
  onClear,
}: IngestPanelProps) {
  return (
    <section className="panel panel--ingest" aria-label="Ingesta de conocimiento">
      <header className="panel__header">
        <p className="panel__eyebrow">Ingesta</p>
        <h2>Cargar fuentes</h2>
        <p className="panel__subtitle">{mode === 'urls' ? 'Introduce URLs que el sistema indexará automáticamente.' : 'Carga archivos TXT, MD o PDF que índexará la base de conocimiento.'}</p>
      </header>

      <div className="ingest-tabs">
        <button className={mode === 'urls' ? 'ingest-tabs__item ingest-tabs__item--active' : 'ingest-tabs__item'} onClick={() => onModeChange('urls')}>URLs</button>
        <button className={mode === 'files' ? 'ingest-tabs__item ingest-tabs__item--active' : 'ingest-tabs__item'} onClick={() => onModeChange('files')}>Archivos</button>
      </div>

      <div className="ingest-form">
        {mode === 'urls' && (
          <label>
            URLs
            <textarea
              value={urlsText}
              onChange={(event) => onUrlsChange(event.target.value)}
              placeholder={'https://ejemplo.com/articulo\nhttps://es.wikipedia.org/wiki/...' }
              aria-label="URLs a ingerir"
            />
          </label>
        )}

        {mode === 'files' && (
          <label>
            Archivos (TXT, MD, PDF)
            <input
              type="file"
              multiple
              accept=".txt,.md,.pdf"
              onChange={(event) => onHandleFileSelect(event.target.files)}
              aria-label="Archivos a ingerir"
            />
            {uploadedFiles.length > 0 && (
              <ul className="ingest-form__filelist">
                {uploadedFiles.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            )}
            {fileValidationErrors.length > 0 && (
              <div className="feedback feedback--error">
                {fileValidationErrors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            )}
          </label>
        )}

        <label>
          Tags opcionales
          <input
            value={tagsText}
            onChange={(event) => onTagsChange(event.target.value)}
            placeholder="research, product, legal"
            aria-label="Tags para la ingesta"
          />
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
          {isLoading
            ? mode === 'files'
              ? 'Procesando archivos...'
              : 'Procesando fuentes...'
            : mode === 'files'
              ? 'Ingerir archivos'
              : 'Ingerir fuentes'}
        </button>
      </div>

      {mode === 'files' && fileProgress.length > 0 && (
        <div className="ingest-progress" aria-live="polite">
          <p className="ingest-progress__title">Progreso por archivo</p>
          <ul className="ingest-progress__list">
            {fileProgress.map((item) => (
              <li key={item.id} className={`ingest-progress__item ingest-progress__item--${item.status}`}>
                <span>{item.name}</span>
                <span>{item.status === 'uploading' ? 'Procesando' : item.status === 'done' ? 'Completado' : item.status === 'error' ? 'Error' : 'Pendiente'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                <li>Fuentes procesadas: {result.processedUrls}</li>
                <li>Fuentes correctas: {result.successfulUrls}</li>
                <li>Fuentes fallidas: {result.failedUrls}</li>
              </ul>
              {result.results.length > 0 && (
                <div className="ingest-results">
                  {result.results.map((item) => (
                    <article key={item.sourceUrl} className="ingest-result-card">
                      <h3>{item.title}</h3>
                      <p>{item.sourceUrl}</p>
                      <ul>
                        <li>Tipo: {item.sourceType}</li>
                        <li>Extracción: {item.extractionMode}</li>
                        <li>Chunks guardados: {item.savedChunks}/{item.totalChunks}</li>
                        <li>Duplicados: {item.duplicateChunks}</li>
                        <li>Reemplazados: {item.replacedChunks}</li>
                      </ul>
                    </article>
                  ))}
                </div>
              )}
              {result.failures.length > 0 && (
                <div className="feedback feedback--error">
                  {result.failures.map((failure) => (
                    <p key={failure.url}>{failure.url}: {failure.reason}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
