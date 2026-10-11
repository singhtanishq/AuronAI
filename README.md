# Auron AI

A locally runnable, open-source AI chatbot powered by Ollama.

**Auron AI** — Powered by Tanishq Singh

## Overview

Auron AI is a modern, privacy-friendly, local-first AI assistant that runs entirely on your machine. It uses locally hosted open-weight language models through Ollama, ensuring your conversations never leave your device.

## Features

- **Local-First Architecture**: All AI inference runs locally via Ollama — no API keys, no cloud dependencies
- **Real-time Streaming**: Responses stream token-by-token as a single coherent message over Server-Sent Events
- **Conversation Memory**: Full chat history is included in model context with an automatic character budget
- **Chat History**: Persistent conversations with search, pin, rename, archive, and delete
- **Authentication**: Local accounts with Argon2id password hashing and server-side session cookies
- **Theme Support**: Light, dark, and system-preference themes with pre-paint theme application
- **Model Selection**: Choose from any Ollama model installed on your machine
- **Responsive Design**: Works on desktop, tablet, and mobile with a collapsible sidebar and mobile drawer
- **Markdown & Code**: Sanitized markdown rendering with syntax highlighting and working copy buttons
- **Keyboard Shortcuts**: Ctrl/Cmd+K (search), Ctrl/Cmd+N (new chat), Escape (close overlays)
- **Accessibility**: Semantic HTML, keyboard navigation, ARIA labels, focus management, reduced-motion support

## Architecture

```
┌───────────────────────┐
│      Auron Frontend   │
│     React + TS        │
└───────────┬───────────┘
            │
            ↓
┌───────────────────────┐
│     Auron Backend     │
│  Node.js + Express    │
└───────────┬───────────┘
     ┌──────┴──────┐
     ↓             ↓
 SQLite         Ollama
 Database         │
                  ↓
            Local LLM
```

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite for fast development
- Tailwind CSS with a semantic, variable-backed design-token system
- Zustand for state management
- React Router for navigation
- Lucide React for icons
- Marked + DOMPurify for sanitized markdown rendering
- Highlight.js (core + common languages) for syntax highlighting

**Backend:**
- Node.js + Express + TypeScript
- Better-SQLite3 with a versioned migration runner
- Argon2id for password hashing
- Opaque server-side sessions stored as SHA-256 hashes in SQLite
- Server-Sent Events (SSE) for streaming
- Zod input validation, express-rate-limit protection

**AI Provider:**
- Ollama integration behind a provider abstraction
- Supports any Ollama-compatible model (Qwen, Gemma, Llama, etc.)
- Per-generation abort handling with idle and overall timeouts

## Why Local-First?

- **Privacy**: Your conversations never leave your machine
- **No API Costs**: Run unlimited conversations without paying for API calls
- **Offline Capable**: Works without internet once models are downloaded (no remote fonts or CDNs are used)
- **Data Ownership**: You control your data completely
- **No Tracking**: No telemetry, analytics, or third-party data collection

## Requirements

### Minimum Practical Hardware
- Modern CPU (Apple Silicon or modern x86)
- Approximately 8 GB RAM
- Sufficient free storage (2-10 GB for models)

### Recommended
- 16 GB+ RAM
- Stronger CPU/GPU
- Additional storage for larger models

### Software Requirements
- Node.js 20+
- Ollama (see installation below)

## Installation

### 1. Install Ollama

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from [ollama.com](https://ollama.com/download)

### 2. Pull a Model

Auron AI works with any Ollama model. For machines with ~8 GB RAM, we recommend:

```bash
# Lightweight, fast model (recommended for 8GB RAM)
ollama pull qwen2.5:3b

# Alternative lightweight options
ollama pull gemma2:2b
ollama pull llama3.2:3b

# For more powerful machines (16GB+ RAM)
ollama pull qwen2.5:7b
ollama pull llama3.1:8b
```

### 3. Clone and Install

```bash
git clone https://github.com/yourusername/AuronAI.git
cd AuronAI

# Install all dependencies (root, frontend, backend)
npm install
```

### 4. Configure Environment (Optional)

Copy the example environment files and adjust if needed:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend (usually not needed)
cp frontend/.env.example frontend/.env
```

Default configuration works out of the box:
- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`
- Ollama: `http://localhost:11434`
- Default model: `qwen2.5:3b`

### 5. Start Development Servers

```bash
# Runs both frontend and backend concurrently
npm run dev
```

Or run separately:

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

### 6. Open in Browser

Navigate to `http://localhost:5173`

## Production Build

```bash
# Build both frontend and backend
npm run build

# Start production server
npm run start
```

With `NODE_ENV=production`, the backend serves the compiled frontend from
`frontend/dist` (configurable via `STATIC_ROOT`) and handles SPA routing.
Unknown `/api/*` routes return JSON 404s and are never answered with the SPA
shell. If you deploy the frontend separately, serve it from any static host
and point it at the backend; see `STATIC_ROOT` in `backend/.env.example`.

## Database Migrations

The backend applies versioned migrations automatically on startup and records
them in a `schema_migrations` table — startup is repeatable and safe. To run
or verify migrations explicitly (for operators):

```bash
npm run db:migrate   # applies pending migrations, prints the schema version
npm run db:init      # initializes a fresh database (also automatic)
```

Migrations are backward-compatible and never delete data. The first upgrade
of an existing database normalizes timestamps to ISO 8601 UTC and adds a
unique index on session token hashes.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | Environment mode (`production` enables secure cookies + static serving) |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS |
| `DATABASE_PATH` | `./data/auron.db` | SQLite database path |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_DEFAULT_MODEL` | `qwen2.5:3b` | Default model name |
| `OLLAMA_TIMEOUT` | `300000` | Generation hard cap (ms) |
| `OLLAMA_IDLE_TIMEOUT` | `60000` | Max gap between stream chunks (ms) |
| `CHAT_MAX_CONTEXT_CHARS` | `24000` | History character budget per request |
| `CHAT_MAX_CONCURRENT` | `2` | Concurrent generations per user |
| `RATE_LIMIT_MAX` | `300` | General API requests per 15 min |
| `AUTH_RATE_LIMIT_MAX` | `20` | Login/signup attempts per 15 min |
| `SESSION_COOKIE_NAME` | `auron_session` | Session cookie name |
| `STATIC_ROOT` | `../frontend/dist` | Built frontend directory for production serving |

> **No session secret is required.** Sessions are opaque random tokens stored
> only as SHA-256 hashes in the database and delivered in an HttpOnly cookie —
> there is nothing to sign and no secret to leak.

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `/api` | API base path (proxied in dev) |

## Project Structure

```
AuronAI/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # Chat, sidebar, and UI primitives
│   │   ├── pages/            # Login, signup, settings, profile
│   │   ├── contexts/         # Auth, Theme
│   │   ├── stores/           # Zustand stores
│   │   ├── services/         # API client + SSE reader
│   │   ├── utils/            # Markdown pipeline, SSE parser, formatting
│   │   ├── styles/           # Design tokens and global styles
│   │   ├── App.tsx           # Routes and app shell
│   │   └── main.tsx          # Entry point
│   └── vitest.config.ts
│
├── backend/                  # Express backend
│   ├── src/
│   │   ├── config/           # Centralized configuration
│   │   ├── routes/           # Auth, conversations, AI, settings, health
│   │   ├── services/         # Auth + chat orchestration
│   │   ├── providers/        # AI provider abstraction (Ollama)
│   │   ├── repositories/     # SQLite data access
│   │   ├── middleware/       # Auth, validation, error handling
│   │   ├── database/         # Connection, migrations
│   │   ├── prompts/          # System prompt
│   │   ├── types/            # Shared types
│   │   ├── utils/            # Logger, time helpers
│   │   ├── app.ts            # Express app setup
│   │   └── server.ts         # Entry point (graceful shutdown)
│   └── vitest.config.ts
│
├── docs/                     # Architecture and development docs
├── package.json              # Root workspace config
└── README.md
```

## API Architecture

### Endpoints

**Authentication**
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/logout-all
GET    /api/auth/me
GET    /api/auth/sessions
DELETE /api/auth/sessions/:id
POST   /api/auth/change-password
PATCH  /api/auth/profile
DELETE /api/auth/account
```

**Conversations**
```
GET    /api/conversations
GET    /api/conversations/search?q=...
GET    /api/conversations/pinned
POST   /api/conversations
GET    /api/conversations/:id
PATCH  /api/conversations/:id
DELETE /api/conversations/:id
DELETE /api/conversations (bulk, requires { confirm: "DELETE ALL" })
```

**AI / Chat**
```
POST   /api/ai/chat        (SSE streaming)
POST   /api/ai/regenerate  (SSE streaming)
POST   /api/ai/abort
GET    /api/ai/models
GET    /api/ai/health
```

**Settings**
```
GET    /api/settings
PATCH  /api/settings
```

**Health**
```
GET    /api/health
GET    /api/health/ai
GET    /api/health/models
```

### Streaming protocol

`POST /api/ai/chat` responds with Server-Sent Events carrying JSON payloads:

```
data: {"type":"start","conversationId":"…","userMessageId":"…","assistantMessageId":"…"}
data: {"type":"delta","assistantMessageId":"…","content":"partial text"}
data: {"type":"title","conversationId":"…","title":"Generated title"}
data: {"type":"done","conversationId":"…","assistantMessageId":"…"}
data: {"type":"aborted","conversationId":"…","assistantMessageId":"…"}
data: {"type":"error","assistantMessageId":"…","message":"…"}
```

Exactly one assistant message is created per submission; `delta` events append
to it. Partial output is flushed to SQLite while streaming and preserved with
an `aborted` or `error` status if the generation stops early.

## Database Architecture

### Schema

```sql
users
├── id (PK)
├── name
├── email (UNIQUE)
├── password_hash (argon2id)
├── avatar_color
├── created_at
└── updated_at

conversations
├── id (PK)
├── user_id (FK → users, CASCADE)
├── title
├── pinned
├── archived
├── created_at
└── updated_at

messages
├── id (PK)
├── conversation_id (FK → conversations, CASCADE)
├── role (user/assistant/system)
├── content
├── model
├── status (pending/streaming/completed/error/aborted)
├── token_count
├── generation_time_ms
├── created_at
└── updated_at

user_preferences
├── user_id (PK, FK → users, CASCADE)
├── theme
├── sidebar_collapsed
├── enter_to_send
├── show_timestamps
├── auto_scroll
├── model
├── temperature
└── system_prompt

sessions
├── id (PK)
├── user_id (FK → users, CASCADE)
├── token_hash (UNIQUE, SHA-256)
├── expires_at
└── created_at
```

## AI Provider Architecture

Auron uses a provider abstraction for AI integration:

```typescript
interface AIProvider {
  name: string;
  generate(request: ChatRequest): Promise<string>;
  stream(request: ChatRequest, onChunk, signal?): Promise<StreamResult>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<ProviderHealth>;
}
```

`stream` always resolves with a terminal `StreamResult`
(`completed | aborted | error`), so an upstream failure can never be mistaken
for a successful response. Currently implemented: `OllamaProvider`.

## Authentication

- **Local accounts only** — no OAuth, no third-party dependencies
- **Argon2id** password hashing (memory-hard, resistant to GPU attacks)
- **Opaque session tokens**: 256-bit random tokens, stored as SHA-256 hashes, delivered in HttpOnly, SameSite=Lax cookies (Secure in production)
- Sessions expire after 30 days; password changes revoke all sessions
- **No tokens in localStorage** — authentication restoration asks the server via `/api/auth/me`
- Rate limiting on credential endpoints (login/signup), separate from normal app traffic
- Login responses are identical for unknown emails and wrong passwords, with matched response timing

## Chat Features

### Streaming Responses
Responses stream token-by-token via SSE. One submission produces exactly one
assistant message; the UI batches incoming deltas with `requestAnimationFrame`
so long responses stay smooth.

### Message Actions
- **Copy**: Copy message content to clipboard (with fallback for non-secure contexts)
- **Copy code**: Per-block copy buttons inside rendered markdown
- **Regenerate**: Generate an alternative response using the correct context
- **Retry**: Retry failed generations
- **Stop**: Abort generation; partial output is kept and marked `aborted`

### Conversation Management
- **Auto-title**: The first exchange generates a descriptive title (falls back to the opening words)
- **Pin**: Keep important chats at top
- **Archive**: Hide without deleting, with a restorable Archived section
- **Search**: Search across titles and message content
- **Delete**: Single or bulk with typed confirmation

## Settings

### Appearance
- Theme: Light / Dark / System
- Sidebar collapsed default

### Chat
- Enter to send / Ctrl+Enter to send
- Show timestamps
- Auto-scroll behavior

### AI Model
- Model selection from available Ollama models (with download sizes)
- Temperature (0.0 - 2.0)
- Custom system prompt

## Troubleshooting

### Ollama Not Running
```bash
# Start Ollama service
ollama serve

# Or on macOS with Homebrew
brew services start ollama
```
Auron AI shows a persistent banner with a Retry button whenever Ollama is
unreachable; conversation history remains readable without Ollama.

### Model Missing
```bash
# Pull the model
ollama pull qwen2.5:3b

# List available models
ollama list
```
If a stored preference references a removed model, Auron falls back to the
first installed model and tells you so.

### Backend Cannot Connect to Ollama
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check `OLLAMA_BASE_URL` in backend `.env`
- Ensure no firewall blocking localhost:11434

### Port Already In Use
```bash
# Change backend port
PORT=3002 npm run dev:backend

# Or change frontend port in vite.config.ts
```

### Slow Responses
- Local LLM inference speed depends on hardware
- Try smaller models (3B parameters) for faster responses
- Close other applications to free RAM

## Development

### Commands

```bash
# Install all dependencies
npm install

# Development (both frontend & backend)
npm run dev

# Build all
npm run build

# Lint
npm run lint

# Type check
npm run typecheck

# Tests (Vitest; backend tests use a disposable temp database and a mock provider)
npm run test

# Database
npm run db:init      # Initialize database
npm run db:migrate   # Apply/verify migrations
```

### Testing

The test suites cover the areas most likely to regress:

- **Migrations**: fresh installs, idempotent reruns, legacy timestamp normalization, deterministic message ordering
- **Auth service**: signup/login/logout, session expiry, password changes, profile updates (including combined name+email), account deletion cascades
- **Chat service**: content persistence, conversation context construction, abort/error terminal states, cross-user protection, concurrency limits
- **HTTP API**: signup/login/me flows, ownership enforcement, streaming protocol, regeneration, settings, validation errors
- **Frontend**: SSE parser (partial frames, multiple events per chunk, malformed data), markdown sanitization, timestamp/size formatting

Tests never touch a real user database: the backend suite points
`DATABASE_PATH` at a disposable temp file (with a hard guard that refuses to
run otherwise) and substitutes a scripted mock AI provider.

### Code Style

- TypeScript strict mode enabled
- ESLint configured for both workspaces
- Run `npm run lint` and `npm run typecheck` before committing

## Security Considerations

- Passwords hashed with Argon2id (never stored in plaintext)
- Opaque session tokens, stored as SHA-256 hashes, in HttpOnly cookies
- Every conversation, message, and generation operation enforces per-user ownership at the service layer
- Input validation on all endpoints (Zod schemas)
- Rate limiting on authentication and generation endpoints
- CORS configured for the frontend origin
- SQL injection prevention via parameterized queries
- XSS prevention via DOMPurify-sanitized markdown (script tags, event handlers, and javascript: URLs are stripped; external links get `rel="noopener noreferrer nofollow"`)
- No secrets in frontend code; no bearer tokens in localStorage
- Production error responses hide internal details and stack traces
- Graceful shutdown aborts in-flight generations and closes the database

## Privacy

By default, Auron AI:
- Stores all conversations locally in SQLite (`backend/data/auron.db`)
- Runs AI models locally through Ollama
- Requires no external API keys
- Sends no data to third-party services (no remote fonts, no CDNs, no telemetry)
- Gives you full control over your data

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and linting: `npm run test && npm run lint && npm run typecheck`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## Future Roadmap

The following are **not implemented**; they are ideas for future versions:

- RAG (Retrieval-Augmented Generation) for document Q&A
- Local document uploads and PDF analysis
- Semantic search with local embeddings
- Web search provider integration
- Voice input/output (speech-to-text, text-to-speech)
- Image understanding (multimodal models)
- Tool calling and local agent workflows
- Conversation export/import
- Workspace support for team collaboration
- System prompt presets
- Plugin/tool system

## License

MIT License — see [LICENSE](LICENSE) for details.

## Credits

**Auron AI**
Powered by Tanishq Singh.

Built with:
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Express](https://expressjs.com/)
- [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [Ollama](https://ollama.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Lucide Icons](https://lucide.dev/)
- [Marked](https://marked.js.org/)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [Highlight.js](https://highlightjs.org/)
- [Argon2](https://github.com/ranisalt/node-argon2)

---

*Built with care for local-first AI enthusiasts.*
