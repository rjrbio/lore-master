import { lazy, Suspense, useState } from 'react';
import { useLoreChat } from './hooks/useLoreChat';
import { useLoreIngest } from './hooks/useLoreIngest';

const ChatPanel = lazy(async () => {
  const module = await import('./components/chat/ChatPanel');
  return { default: module.ChatPanel };
});

const IngestPanel = lazy(async () => {
  const module = await import('./components/ingest/IngestPanel');
  return { default: module.IngestPanel };
});

function App() {
  const [activeSection, setActiveSection] = useState<'query' | 'ingest'>('query');
  const chat = useLoreChat();
  const ingest = useLoreIngest();

  const navButtonBase = 'border-b px-0 pb-3 pt-1 text-sm font-medium tracking-[0.08em] uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/30';
  const navButtonIdle = 'border-transparent text-slate-400 hover:border-slate-500/40 hover:text-slate-100';
  const navButtonActive = 'border-cobalt text-white';

  const renderActiveSection = () => {
    if (activeSection === 'query') {
      return (
        <ChatPanel
          question={chat.question}
          onQuestionChange={chat.setQuestion}
          onAsk={chat.sendQuestion}
          isLoading={chat.isLoading}
          canSend={chat.canSend}
          error={chat.error}
          messages={chat.messages}
          onClearHistory={chat.clearHistory}
        />
      );
    }

    return (
      <IngestPanel
        mode={ingest.mode}
        onModeChange={ingest.setMode}
        uploadedFiles={ingest.uploadedFiles}
        fileValidationErrors={ingest.fileValidationErrors}
        fileProgress={ingest.fileProgress}
        urlProgress={ingest.urlProgress}
        onHandleFileSelect={ingest.handleFileSelect}
        urlsText={ingest.urlsText}
        tagsText={ingest.tagsText}
        replaceExisting={ingest.replaceExisting}
        isLoading={ingest.isLoading}
        canIngest={ingest.canIngest}
        error={ingest.error}
        result={ingest.result}
        onUrlsChange={ingest.setUrlsText}
        onTagsChange={ingest.setTagsText}
        onReplaceExistingChange={ingest.setReplaceExisting}
        onIngest={ingest.submitIngest}
        onClear={ingest.clearFeedback}
      />
    );
  };

  return (
    <div className="grid min-h-screen w-full gap-7 px-4 py-4 sm:px-6 md:px-10 md:py-6 xl:px-14">
      <header className="relative overflow-hidden border-b border-slate-200/10 pb-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-32 w-32 rounded-full bg-violet/18 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute left-0 top-2 h-24 w-24 rounded-full bg-cobalt/15 blur-3xl" aria-hidden="true" />

        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Document Retrieval Studio</p>
        <h1 className="mt-3 max-w-6xl font-display text-3xl font-semibold tracking-[-0.04em] text-white md:text-5xl xl:text-6xl">Lore Master Assistant</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300/84 md:text-base">
          Ingesta artículos web, páginas MediaWiki y otras fuentes documentales para consultarlas mediante RAG con MongoDB Atlas Vector Search.
        </p>
      </header>

      <div className="sticky top-[2px] z-20 -mx-4 flex flex-wrap items-end gap-6 border-b border-slate-200/10 bg-transparent px-4 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 xl:-mx-14 xl:px-14" role="tablist" aria-label="Secciones principales">
        <button
          className={`${navButtonBase} ${activeSection === 'query' ? navButtonActive : navButtonIdle}`}
          onClick={() => setActiveSection('query')}
        >
          Consulta
        </button>
        <button
          className={`${navButtonBase} ${activeSection === 'ingest' ? navButtonActive : navButtonIdle}`}
          onClick={() => setActiveSection('ingest')}
        >
          Ingesta
        </button>
      </div>

      <main className="min-h-[58vh] w-full">
        <Suspense fallback={<div className="py-20 text-sm uppercase tracking-[0.14em] text-slate-500">Cargando interfaz…</div>}>
          {renderActiveSection()}
        </Suspense>
      </main>

      <footer className="border-t border-slate-200/10 pt-6 text-sm text-slate-500">
        <p>Base documental activa: consulta RAG e ingesta por URLs o archivos (TXT, MD, PDF, DOCX).</p>
      </footer>
    </div>
  );
}

export default App;