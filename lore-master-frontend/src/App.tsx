import { useState } from 'react';
import { ChatPanel } from './components/chat/ChatPanel';
import { IngestPanel } from './components/ingest/IngestPanel';
import { useLoreChat } from './hooks/useLoreChat';
import { useLoreIngest } from './hooks/useLoreIngest';
import './App.css';

function App() {
  const [activeSection, setActiveSection] = useState<'query' | 'ingest'>('query');
  const chat = useLoreChat();
  const ingest = useLoreIngest();

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="hero__eyebrow">Document Retrieval Studio</p>
        <h1>Lore Master Assistant</h1>
        <p className="hero__subtitle">
          Ingesta artículos web, páginas MediaWiki y otras fuentes documentales para consultarlas mediante RAG con MongoDB Atlas Vector Search.
        </p>
      </header>

      <div className="app-nav" role="tablist" aria-label="Secciones principales">
        <button className={activeSection === 'query' ? 'app-nav__item app-nav__item--active' : 'app-nav__item'} onClick={() => setActiveSection('query')}>Consulta</button>
        <button className={activeSection === 'ingest' ? 'app-nav__item app-nav__item--active' : 'app-nav__item'} onClick={() => setActiveSection('ingest')}>Ingesta</button>
      </div>

      <main className="layout-stack">
        {activeSection === 'query' && (
          <ChatPanel
            question={chat.question}
            onQuestionChange={chat.setQuestion}
            onAsk={chat.sendQuestion}
            isLoading={chat.isLoading}
            canSend={chat.canSend}
            error={chat.error}
            messages={chat.messages}
          />
        )}

        {activeSection === 'ingest' && (
          <IngestPanel
            mode={ingest.mode}
            onModeChange={ingest.setMode}
            uploadedFiles={ingest.uploadedFiles}
            fileValidationErrors={ingest.fileValidationErrors}
            fileProgress={ingest.fileProgress}
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
        )}
      </main>

      <footer className="app-footer">
        <p>Base documental activa: consulta RAG e ingesta por URLs o archivos (TXT, MD, PDF).</p>
      </footer>
    </div>
  );
}

export default App;