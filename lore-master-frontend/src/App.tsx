import { ChatPanel } from './components/chat/ChatPanel';
import { IngestPanel } from './components/ingest/IngestPanel';
import { useLoreChat } from './hooks/useLoreChat';
import { useLoreIngest } from './hooks/useLoreIngest';
import './App.css';

function App() {
  const chat = useLoreChat();
  const ingest = useLoreIngest();

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="hero__eyebrow">MongoDB Atlas Vector Search + OpenAI</p>
        <h1>Lore Master</h1>
        <p className="hero__subtitle">
          RAG sobre Elden Ring con ingesta automatizada desde Fandom y consultas semánticas en tiempo real.
        </p>
      </header>

      <main className="layout-grid">
        <ChatPanel
          question={chat.question}
          onQuestionChange={chat.setQuestion}
          onAsk={chat.sendQuestion}
          isLoading={chat.isLoading}
          canSend={chat.canSend}
          error={chat.error}
          messages={chat.messages}
        />

        <IngestPanel
          url={ingest.url}
          category={ingest.category}
          replaceExisting={ingest.replaceExisting}
          isLoading={ingest.isLoading}
          canIngest={ingest.canIngest}
          error={ingest.error}
          result={ingest.result}
          onUrlChange={ingest.setUrl}
          onCategoryChange={ingest.setCategory}
          onReplaceExistingChange={ingest.setReplaceExisting}
          onIngest={ingest.submitIngest}
          onClear={ingest.clearFeedback}
        />
      </main>

      <footer className="app-footer">
        <p>Soporte multi-locale de Fandom (en, es, fr, de, pt-br y más) con fallback HTML.</p>
      </footer>
    </div>
  );
}

export default App;