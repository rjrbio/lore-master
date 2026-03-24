# Lore Master

**Lore Master** es una aplicación fullstack de RAG (*Retrieval-Augmented Generation*) de propósito general. Permite ingerir conocimiento desde URLs públicas o archivos locales (TXT, MD, PDF, DOCX), indexarlo como vectores semánticos en **MongoDB Atlas Vector Search**, y responder preguntas en lenguaje natural sobre el contenido ingestado usando **GPT-4o**.

---

## Arquitectura

```
[ React 19 + Vite (Frontend) ]
            │
        HTTP / axios
       (proxy nginx /api)
            │
[ NestJS 11 API (Backend) ]
            │
    ┌───────┴────────────────┐
    │                        │
[ MongoDB Atlas ]       [ OpenAI API ]
  Vector Search      Embeddings + Chat
```

---

## Características principales

- **Ingesta multi-fuente** — URLs públicas, páginas Fandom/Wikipedia (con fallback API MediaWiki) y archivos locales (TXT, MD, PDF, DOCX).
- **Triple estrategia de extracción** — Jina AI Reader → API MediaWiki → scraping HTML con Cheerio, con fallback automático.
- **Chunking semántico** — División por secciones Markdown y párrafos, con longitud configurable y filtrado de ruido (nav, cookies, ads).
- **Deduplicación** — Hash SHA-256 por `sourceUrl + contenido` evita chunks duplicados. Opción de reemplazo total por fuente.
- **Búsqueda vectorial** — `$vectorSearch` de MongoDB Atlas con threshold configurable para recuperar los fragmentos más relevantes.
- **Chat conversacional** — Historial de conversación con condensación automática de preguntas de seguimiento (gpt-4o-mini).
- **Respuestas contextualizadas** — GPT-4o recibe únicamente el contexto documental recuperado y cita fuentes.
- **Persistencia de chat** — El historial se guarda en localStorage del navegador.
- **Progreso en tiempo real** — Indicadores de estado por URL/archivo durante la ingesta.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 3 |
| Backend | NestJS 11, TypeScript (strict) |
| Base de datos | MongoDB Atlas (Vector Search) |
| Embeddings | OpenAI `text-embedding-3-small` (1 536 dims) |
| Chat LLM | OpenAI `gpt-4o` |
| Condensación | OpenAI `gpt-4o-mini` |
| ODM | Mongoose 9 |
| Extracción | Jina AI Reader, Axios, Cheerio, mammoth, pdf-parse |
| Seguridad | Helmet, CORS, Throttler, ValidationPipe, CSP |
| Despliegue | Docker multi-stage, Nginx, docker-compose |

---

## Estructura del proyecto

```
lore-master/
├── docker-compose.yml
├── README.md
├── lore-master-backend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── scripts/
│   │   └── create-indexes.js      # Creación de índices MongoDB
│   └── src/
│       ├── main.ts                 # Bootstrap (Helmet, CORS, limits)
│       ├── app.module.ts           # Módulo raíz (config, DB, throttler)
│       ├── app.controller.ts       # Health check + root
│       └── lore/
│           ├── lore.controller.ts  # Endpoints REST
│           ├── lore.service.ts     # Lógica RAG, ingesta, chunking
│           ├── lore.schema.ts      # Modelo Mongoose + índices
│           ├── lore.module.ts
│           ├── lore.service.spec.ts # Tests unitarios
│           └── dto/
│               ├── ask.dto.ts
│               ├── create-lore.dto.ts
│               └── ingest-urls.dto.ts
└── lore-master-frontend/
    ├── Dockerfile
    ├── nginx.conf                  # Proxy /api, gzip, headers seguridad
    ├── package.json
    ├── index.html                  # CSP, meta tags
    └── src/
        ├── App.tsx                 # Layout + navegación
        ├── main.tsx
        ├── index.css               # Tailwind + tema custom
        ├── components/
        │   ├── chat/ChatPanel.tsx   # Interfaz de consulta RAG
        │   └── ingest/IngestPanel.tsx # Interfaz de ingesta
        ├── hooks/
        │   ├── useLoreChat.ts      # Estado del chat
        │   └── useLoreIngest.ts    # Estado de ingesta
        ├── services/
        │   └── loreApi.ts          # Cliente HTTP con retry
        └── types/
            └── lore.ts             # Tipos compartidos
```

---

## Endpoints de la API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Health check (estado de la BD) |
| `POST` | `/documents/manual` | Creación manual de un fragmento |
| `POST` | `/documents/ingest` | Ingesta automática desde URLs |
| `POST` | `/documents/ingest-files` | Ingesta de archivos (multipart) |
| `POST` | `/documents/query` | Pregunta RAG con historial conversacional |
| `GET` | `/documents/search?q=` | Búsqueda vectorial directa |
| `GET` | `/documents?skip=&limit=` | Lista documentos agrupados por fuente |
| `GET` | `/documents/all?skip=&limit=` | Lista todos los chunks (paginado) |

**Rate limiting**: 30 req/min global, 5 req/min en endpoints de ingesta.

---

## Puesta en marcha

### Requisitos previos

- Node.js ≥ 20
- Cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas) con un índice vectorial configurado
- API Key de [OpenAI](https://platform.openai.com)

### Índice vectorial en MongoDB Atlas

Crea un índice llamado `vector_index` en la colección `lores` con esta configuración:

```json
{
  "name": "vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
      }
    ]
  }
}
```

Luego ejecuta el script de índices regulares:

```bash
cd lore-master-backend
MONGODB_URI="tu-connection-string" node scripts/create-indexes.js
```

### Desarrollo local

**Backend:**

```bash
cd lore-master-backend
cp .env.example .env           # Edita con tus credenciales
npm install
npm run start:dev              # http://localhost:3000
```

**Frontend:**

```bash
cd lore-master-frontend
npm install
npm run dev                    # http://localhost:5173
```

### Producción con Docker

```bash
# 1. Configura las variables de entorno
cp lore-master-backend/.env.example lore-master-backend/.env
# Edita .env con tus valores de producción

# 2. Levanta los servicios
docker compose up -d --build

# Frontend en http://localhost:8080
# Backend en http://localhost:3000 (accesible vía /api desde frontend)
```

### Variables de entorno

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `OPENAI_API_KEY` | **Sí** | — | API key de OpenAI |
| `MONGODB_URI` | **Sí** | — | Connection string de MongoDB Atlas |
| `NODE_ENV` | No | `development` | `development`, `production` o `test` |
| `PORT` | No | `3000` | Puerto del backend |
| `FRONTEND_URL` | **Sí (prod)** | `http://localhost:5173` | Origen permitido para CORS |
| `OPENAI_CHAT_MODEL` | No | `gpt-4o` | Modelo para respuestas RAG |
| `OPENAI_EMBEDDING_MODEL` | No | `text-embedding-3-small` | Modelo de embeddings |
| `MIN_CHUNK_LENGTH` | No | `120` | Longitud mínima de chunk (chars) |
| `MAX_CHUNK_LENGTH` | No | `1900` | Longitud máxima de chunk (chars) |
| `VECTOR_SEARCH_THRESHOLD` | No | `0.72` | Score mínimo para resultados vectoriales |
| `BACKEND_PORT` | No | `3000` | Puerto del host para Docker |
| `FRONTEND_PORT` | No | `8080` | Puerto del host para Docker |

---

## Flujo RAG

```
Fuente (URL / archivo)
    │
    ▼
Extracción de texto (Jina AI → API MediaWiki → Cheerio/mammoth/pdf-parse)
    │
    ▼
Normalización + filtrado de ruido
    │
    ▼
Chunking semántico (secciones + párrafos, ≤ MAX_CHUNK_LENGTH chars)
    │
    ▼
Hash SHA-256 por chunk → deduplicación
    │
    ▼
Embedding de cada chunk (text-embedding-3-small)
    │
    ▼
Almacenamiento en MongoDB Atlas
    │
    ─────────────────────────────────────────
              En tiempo de consulta:
    ─────────────────────────────────────────
    │
Pregunta del usuario (+ historial)
    │
    ▼
Condensación de pregunta (gpt-4o-mini, si hay historial)
    │
    ▼
Embedding de la consulta autónoma
    │
    ▼
$vectorSearch → top K chunks (score ≥ threshold)
    │
    ▼
GPT-4o con contexto documental recuperado
    │
    ▼
Respuesta con citación de fuentes
```

---

## Tests

```bash
cd lore-master-backend
npm test              # 21 tests (LoreService + AppController)
npm run test:cov      # Con cobertura
```

---

## Seguridad

- **Helmet** — Headers HTTP de seguridad
- **CORS** — Origen configurado por variable de entorno; falla en producción si no está definido
- **Throttler** — Rate limiting global (30/min) + específico para ingesta (5/min)
- **ValidationPipe** — DTOs con `class-validator`, `whitelist: true`, `forbidNonWhitelisted: true`
- **CSP** — Content Security Policy en el HTML del frontend
- **Nginx headers** — X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection
- **Body limits** — 5 MB para JSON/urlencoded, 10 MB por archivo
- **Docker** — Usuario no-root, multi-stage build, healthchecks
- **TypeScript strict** — `strictNullChecks`, `noImplicitAny`, `noFallthroughCasesInSwitch`

---

## Capturas

La interfaz cuenta con dos secciones:

- **Consulta** — Chat conversacional con historial, renderizado Markdown y citación de fuentes.
- **Ingesta** — Panel para ingestar URLs o archivos con progreso en tiempo real, tags opcionales y opción de reemplazo.
