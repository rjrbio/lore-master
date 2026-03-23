# Lore Master

**Lore Master** es una aplicación fullstack de RAG (*Retrieval-Augmented Generation*) de propósito general. Permite ingerir conocimiento desde cualquier URL pública, indexarlo como vectores semánticos en **MongoDB Atlas Vector Search**, y responder preguntas en lenguaje natural sobre el contenido ingestado usando **GPT-4o**.

---

## Arquitectura

```
[ React + Vite (Frontend) ]
          │
      HTTP / axios
          │
[ NestJS API (Backend) ]
          │
    ┌─────┴──────────────┐
    │                    │
[ MongoDB Atlas ]   [ OpenAI API ]
  Vector Search    Embeddings + GPT-4o
```

---

## Características principales

- **Pipeline de ingesta automática** — Introduce una URL y el sistema extrae el texto, lo divide en *chunks* y lo vectoriza automáticamente.
- **Chunking inteligente** — El texto se divide en fragmentos de hasta 1 800 caracteres respetando párrafos, filtrando ruido de navegación y contenido irrelevante.
- **Búsqueda vectorial** — Usa `$vectorSearch` de MongoDB Atlas para recuperar los 3 fragmentos más semánticamente relevantes a cada consulta.
- **Respuestas contextualizadas** — GPT-4o recibe el contexto recuperado y responde usando únicamente esa información.
- **Chat con historial** — La interfaz mantiene el hilo de la conversación en pantalla.
- **Doble estrategia de scraping** — Intenta primero extraer texto limpio vía [Jina AI Reader](https://r.jina.ai); si falla, hace scraping directo del HTML con Cheerio.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | NestJS 11, TypeScript |
| Base de datos | MongoDB Atlas (Vector Search) |
| Embeddings | OpenAI `text-embedding-3-small` (1 536 dims) |
| LLM | OpenAI `gpt-4o` |
| ODM | Mongoose |
| Scraping | Axios + Cheerio |

---

## Estructura del proyecto

```
lore-master/
├── lore-master-backend/     # API REST con NestJS
│   └── src/
│       ├── app.module.ts    # Módulo raíz (config, MongoDB)
│       └── lore/
│           ├── lore.controller.ts  # Endpoints REST
│           ├── lore.service.ts     # Lógica RAG + ingesta
│           ├── lore.schema.ts      # Modelo Mongoose
│           └── lore.module.ts
└── lore-master-frontend/    # SPA con React + Vite
    └── src/
        └── App.tsx          # Interfaz de chat e ingesta
```

---

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/lore` | Ingesta manual de un fragmento |
| `POST` | `/lore/ingest` | Ingesta automática desde URL |
| `GET` | `/lore/ask?q=` | Pregunta en lenguaje natural (RAG completo) |
| `GET` | `/lore/search?q=` | Búsqueda vectorial (top 3 fragmentos) |
| `GET` | `/lore/all` | Lista todo el contenido almacenado |

---

## Puesta en marcha

### Requisitos previos

- Node.js ≥ 18
- Cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas) con un índice de vector configurado (`vector_index`, campo `embedding`, 1 536 dimensiones, similitud coseno)
- API Key de [OpenAI](https://platform.openai.com)

### Backend

```bash
cd lore-master-backend
npm install
```

Crea un archivo `.env` en `lore-master-backend/`:

```env
MONGODB_URI=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/<db>
OPENAI_API_KEY=sk-...
```

```bash
npm run start:dev
# API disponible en http://localhost:3000
```

### Frontend

```bash
cd lore-master-frontend
npm install
npm run dev
# App disponible en http://localhost:5173
```

---

## Cómo funciona el flujo RAG

```
URL pública
    │
    ▼
Extracción de texto (Jina AI / Cheerio)
    │
    ▼
Chunking (párrafos ≤ 1 800 chars)
    │
    ▼
Embedding de cada chunk (text-embedding-3-small)
    │
    ▼
Almacenamiento en MongoDB Atlas
    │
    ─────────────────────────────────────
         En tiempo de consulta:
    ─────────────────────────────────────
    │
Pregunta del usuario
    │
    ▼
Embedding de la pregunta
    │
    ▼
$vectorSearch → top 3 chunks relevantes
    │
    ▼
GPT-4o con contexto recuperado
    │
    ▼
Respuesta final al usuario
```

---

## Capturas

La interfaz cuenta con dos secciones:

- **Consulta** — chat en tiempo real con historial de conversación.
- **Alimentar Conocimiento** — panel para ingestar nuevas URLs con categoría personalizable.
