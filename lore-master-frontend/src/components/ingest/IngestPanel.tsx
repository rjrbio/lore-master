import { useId } from 'react';
import type { IngestBatchResponse } from '../../types/lore';
import type { IngestItemProgress } from '../../hooks/useLoreIngest';

interface IngestPanelProps {
  mode: 'urls' | 'files';
  onModeChange: (mode: 'urls' | 'files') => void;
  uploadedFiles: File[];
  fileValidationErrors: string[];
  fileProgress: IngestItemProgress[];
  urlProgress: IngestItemProgress[];
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
  urlProgress,
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
  const fileInputId = useId();
  const tabBase = 'border-b px-0 pb-2 pt-1 text-sm font-medium uppercase tracking-[0.12em] transition';
  const tabIdle = 'border-transparent text-slate-400 hover:border-slate-500/40 hover:text-slate-100';
  const tabActive = 'border-cobalt text-white';

  return (
    <section className="glass-panel" aria-label="Ingesta de conocimiento">
      <header className="mb-6 grid gap-2 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-end">
        <div className="grid gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet/85">Ingesta</p>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">Cargar fuentes</h2>
        </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-300/78 md:text-[15px]">{mode === 'urls' ? 'Introduce URLs que el sistema indexará automáticamente.' : 'Carga archivos TXT, MD, PDF o DOCX que indexará la base de conocimiento.'}</p>
      </header>

      <div className="inline-flex gap-6 border-b border-slate-200/10">
        <button className={`${tabBase} ${mode === 'urls' ? tabActive : tabIdle}`} onClick={() => onModeChange('urls')}>URLs</button>
        <button className={`${tabBase} ${mode === 'files' ? tabActive : tabIdle}`} onClick={() => onModeChange('files')}>Archivos</button>
      </div>

      <div className="mt-5 grid max-w-5xl gap-6">
        {mode === 'urls' && (
          <label className="grid gap-2 text-sm font-medium text-slate-100">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">URLs</span>
            <textarea
              className="glass-input min-h-[160px] resize-y"
              value={urlsText}
              onChange={(event) => onUrlsChange(event.target.value)}
              placeholder={'https://ejemplo.com/articulo\nhttps://es.wikipedia.org/wiki/...' }
              aria-label="URLs a ingerir"
            />
          </label>
        )}

        {mode === 'files' && (
          <div className="grid gap-3 text-sm text-slate-100">
            <div className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Archivos</span>
              <p className="text-sm leading-7 text-slate-300/82">Arrastra o selecciona archivos TXT, MD, PDF o DOCX de hasta 15 MB.</p>
            </div>

            <input
              id={fileInputId}
              className="sr-only"
              type="file"
              multiple
              accept=".txt,.md,.pdf,.docx"
              onChange={(event) => onHandleFileSelect(event.target.files)}
              aria-label="Archivos a ingerir"
            />

            <label htmlFor={fileInputId} className="group flex cursor-pointer items-center justify-between gap-6 border-b border-slate-400/35 py-4 transition duration-200 hover:border-cobalt/70">
              <div className="grid gap-1">
                <span className="text-sm font-medium text-slate-100 transition group-hover:text-white">Elegir archivos</span>
                <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Múltiple selección habilitada</span>
              </div>
              <span className="subtle-action">
                Explorar
                <span aria-hidden="true">+</span>
              </span>
            </label>

            {uploadedFiles.length > 0 && (
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{uploadedFiles.length} archivo(s) listo(s) para procesar</p>
            )}

            {uploadedFiles.length > 0 && (
              <ul className="grid gap-0 border-t border-slate-200/10">
                {uploadedFiles.map((file) => (
                  <li key={file.name} className="flex items-center justify-between gap-4 border-b border-slate-200/10 py-3 text-sm text-slate-300/88">
                    <span className="truncate">{file.name}</span>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">listo</span>
                  </li>
                ))}
              </ul>
            )}
            {fileValidationErrors.length > 0 && (
              <div className="border-l-2 border-rose-400 pl-4 text-sm leading-7 text-rose-200">
                {fileValidationErrors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="grid gap-2 text-sm font-medium text-slate-100">
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tags opcionales</span>
          <input
            className="glass-input"
            value={tagsText}
            onChange={(event) => onTagsChange(event.target.value)}
            placeholder="research, product, legal"
            aria-label="Tags para la ingesta"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-100">
          <input
            className="h-4 w-4 accent-cobalt"
            type="checkbox"
            checked={replaceExisting}
            onChange={(event) => onReplaceExistingChange(event.target.checked)}
            aria-label="Reemplazar contenido existente para esta URL"
          />
          <span className="leading-7 text-slate-300/88">Reemplazar contenido existente para esta URL</span>
        </label>

        <button className="neon-button w-fit py-2.5" onClick={onIngest} disabled={!canIngest} aria-busy={isLoading}>
          {isLoading
            ? mode === 'files'
              ? 'Procesando archivos...'
              : 'Procesando fuentes...'
            : mode === 'files'
              ? 'Ingerir archivos'
              : 'Ingerir fuentes'}
        </button>
      </div>

      {mode === 'urls' && urlProgress.length > 0 && (
        <div className="mt-6 max-w-5xl border-t border-slate-200/10 pt-3" aria-live="polite" aria-busy={isLoading}>
          <div className="mb-3 flex items-center gap-3">
            <p className="text-sm uppercase tracking-[0.12em] text-slate-400">Progreso por URL</p>
            {isLoading && (
              <span className="flex gap-1.5" aria-label="Procesando">
                <span className="h-1.5 w-1.5 rounded-full bg-cobalt animate-pulseY" />
                <span className="h-1.5 w-1.5 rounded-full bg-violet animate-pulseY [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-cobalt animate-pulseY [animation-delay:0.4s]" />
              </span>
            )}
          </div>
          <ul className="grid gap-0">
            {urlProgress.map((item) => (
              <li
                key={item.id}
                className={`grid gap-1 border-b border-slate-200/10 px-0 py-3 text-sm ${
                  item.status === 'done'
                    ? 'text-emerald-100'
                    : item.status === 'error'
                      ? 'text-rose-100'
                      : item.status === 'uploading'
                        ? 'text-slate-100'
                        : 'text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.16em]">
                    {item.status === 'uploading' ? 'Procesando' : item.status === 'done' ? 'Completado' : item.status === 'error' ? 'Error' : 'Pendiente'}
                  </span>
                </div>
                {item.status === 'uploading' && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-700/50">
                    <div className="h-full animate-indeterminate rounded-full bg-gradient-to-r from-cobalt via-violet to-cobalt" />
                  </div>
                )}
                {item.detail && item.status !== 'uploading' && (
                  <p className="text-xs text-slate-400">{item.detail}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'files' && fileProgress.length > 0 && (
        <div className="mt-6 max-w-5xl border-t border-slate-200/10 pt-3" aria-live="polite" aria-busy={isLoading}>
          <p className="mb-3 text-sm uppercase tracking-[0.12em] text-slate-400">Progreso por archivo</p>
          <ul className="grid gap-2">
            {fileProgress.map((item) => (
              <li
                key={item.id}
                className={`flex justify-between gap-3 border-b border-slate-200/10 px-0 py-3 text-sm ${
                  item.status === 'done'
                    ? 'text-emerald-100'
                    : item.status === 'error'
                      ? 'text-rose-100'
                      : item.status === 'uploading'
                        ? 'text-slate-100'
                        : 'text-slate-200'
                }`}
              >
                <span className="truncate">{item.name}</span>
                <span className="text-[11px] uppercase tracking-[0.16em]">{item.status === 'uploading' ? 'Procesando' : item.status === 'done' ? 'Completado' : item.status === 'error' ? 'Error' : 'Pendiente'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(error || result) && (
        <div className={`mt-6 grid max-w-5xl gap-3 border-t pt-3 ${error ? 'border-rose-400/30 text-rose-100' : 'border-emerald-300/25 text-emerald-100'}`}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <strong>{error ? 'Ingesta fallida' : 'Ingesta completada'}</strong>
            <button className="subtle-action justify-start" onClick={onClear} aria-label="Limpiar estado">Cerrar</button>
          </div>

          {error && <p role="alert" className="text-sm leading-6">{error}</p>}

          {result && (
            <>
              <p className="text-sm leading-6">{result.message}</p>
              <ul className="grid gap-1 pl-5 text-sm text-slate-100 list-disc">
                <li>Fuentes procesadas: {result.processedUrls}</li>
                <li>Fuentes correctas: {result.successfulUrls}</li>
                <li>Fuentes fallidas: {result.failedUrls}</li>
              </ul>
              {result.results.length > 0 && (
                <div className="grid gap-3">
                  {result.results.map((item) => (
                    <article key={item.sourceUrl} className="border-l border-slate-200/20 pl-4">
                      <h3 className="font-display text-lg text-white">{item.title}</h3>
                      <p className="mt-1 break-all text-sm text-slate-300/80">{item.sourceUrl}</p>
                      <ul className="mt-2 grid gap-1 pl-5 text-sm list-disc text-slate-100">
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
                <div className="border-l-2 border-rose-400 pl-4 text-sm leading-7 text-rose-200">
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
