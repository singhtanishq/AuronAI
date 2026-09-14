# Auron AI

A locally runnable, open-source AI chatbot powered by Ollama.

**Auron AI** — Powered by Tanishq Singh

## Overview

Auron AI is a modern, privacy-friendly, local-first AI assistant that runs entirely on your machine. It uses locally hosted open-weight language models through Ollama, ensuring your conversations never leave your device.

## Features

- **Local-First Architecture**: All AI inference runs locally via Ollama — no API keys, no cloud dependencies
- **Real-time Streaming**: Watch responses generate token-by-token with smooth streaming
- **Chat History**: Persistent conversations with full history, search, pin, rename, and delete
- **Authentication**: Secure local accounts with Argon2 password hashing
- **Theme Support**: Light, dark, and system-preference themes with smooth transitions
- **Model Selection**: Choose from any Ollama model installed on your machine
- **Responsive Design**: Works beautifully on desktop, tablet, and mobile
- **Markdown & Code**: Full markdown rendering with syntax highlighting and copy buttons
- **Keyboard Shortcuts**: Efficient navigation with Ctrl/Cmd+K (search), Ctrl/Cmd+N (new chat), Escape (close)
- **Accessibility**: Semantic HTML, keyboard navigation, ARIA labels, focus management

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
            │
     ┌──────┴──────┐
     ↓             ↓
 SQLite         Ollama
 Database          │
                   ↓
             Local LLM
```

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite for fast development
- Tailwind CSS for styling
- Zustand for state management
- React Router for navigation
- Lucide React for icons
- Marked + DOMPurify for markdown rendering
- Highlight.js for syntax highlighting
- date-fns for date formatting

**Backend:**
- Node.js + Express + TypeScript
- Better-SQLite3 for database
- Argon2 for password hashing
- JWT-based authentication (HS256)
- Server-Sent Events (SSE) for streaming
- Express Rate Limit for protection

**AI Provider:**
- Ollama integration with provider abstraction
- Supports any Ollama-compatible model (Qwen, Gemma, Llama, etc.)
- Health checking and model listing

## Why Local-First?

- **Privacy**: Your conversations never leave your machine
- **No API Costs**: Run unlimited conversations without paying for API calls
- **Offline Capable**: Works without internet once models are downloaded
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

> **Note**: Larger AI models require more memory and may generate responses more slowly. Performance depends on your hardware and model size.

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

Copy the example environment file and adjust if needed:

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

The backend will serve the built frontend assets automatically.

## Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | Environment mode |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS |
| `DATABASE_PATH` | `./data/auron.db` | SQLite database path |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_DEFAULT_MODEL` | `qwen2.5:3b` | Default model name |
| `OLLAMA_TIMEOUT` | `120000` | Request timeout (ms) |
| `SESSION_SECRET` | auto-generated | JWT signing secret |
| `SESSION_COOKIE_NAME` | `auron_session` | Session cookie name |

### Frontend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `/api` | API base path (proxied in dev) |

## Project Structure

```
AuronAI/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── contexts/         # React contexts (Auth, Theme)
│   │   ├── stores/           # Zustand stores
│   │   ├── services/         # API client
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Utility functions
│   │   ├── styles/           # Global styles
│   │   ├── App.tsx           # Main app component
│   │   └── main.tsx          # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── backend/                   # Express backend
│   ├── src/
│   │   ├── config/           # Configuration
│   │   ├── controllers/      # Route controllers
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   ├── providers/        # AI provider abstraction
│   │   ├── repositories/     # Data access layer
│   │   ├── middleware/       # Express middleware
│   │   ├── database/         # Database setup
│   │   ├── types/            # TypeScript types
│   │   ├── prompts/          # System prompts
│   │   ├── app.ts            # Express app setup
│   │   └── server.ts         # Entry point
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                      # Documentation
│   ├── architecture.md
│   └── development.md
│
├── package.json               # Root workspace config
├── .gitignore
├── auto-push.sh              # Existing auto-commit script
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
DELETE /api/conversations (bulk)
```

**AI / Chat**
```
POST   /api/ai/chat (SSE streaming)
POST   /api/ai/regenerate (SSE streaming)
POST   /api/ai/abort
GET    /api/ai/models
GET    /api/ai/health
```

**Settings**
```
GET    /api/settings
PATCH  /api/settings
PATCH  /api/settings/theme
PATCH  /api/settings/sidebar
PATCH  /api/settings/model
PATCH  /api/settings/temperature
PATCH  /api/settings/system-prompt
```

**Health**
```
GET    /api/health
GET    /api/health/ai
GET    /api/health/models
```

### Request Flow

```
User enters prompt
       ↓
Frontend validation
       ↓
POST /api/ai/chat
       ↓
Backend authenticates user
       ↓
Backend loads conversation
       ↓
Backend builds model context
       ↓
Ollama receives request
       ↓
Streaming tokens
       ↓
Backend streams to frontend (SSE)
       ↓
Frontend renders response
       ↓
Final message persisted
```

## Database Architecture

### Schema

```sql
users
├── id (PK)
├── name
├── email (UNIQUE)
├── password_hash
├── avatar_color
├── created_at
└── updated_at

conversations
├── id (PK)
├── user_id (FK)
├── title
├── pinned
├── archived
├── created_at
└── updated_at

messages
├── id (PK)
├── conversation_id (FK)
├── role (user/assistant/system)
├── content
├── model
├── status (pending/streaming/completed/error/aborted)
├── token_count
├── generation_time_ms
├── created_at
└── updated_at

user_preferences
├── user_id (PK, FK)
├── theme
├── sidebar_collapsed
├── enter_to_send
├── show_timestamps
├── auto_scroll
├── model
├── temperature
├── system_prompt
├── created_at
└── updated_at

sessions
├── id (PK)
├── user_id (FK)
├── token_hash
├── expires_at
└── created_at
```

## AI Provider Architecture

Auron uses a provider abstraction for AI integration:

```typescript
interface AIProvider {
  name: string;
  generate(request: ChatRequest): Promise<string>;
  stream(request: ChatRequest, onChunk: (chunk: StreamChunk) => void): Promise<void>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<{ reachable: boolean; models: number; defaultModel?: string; error?: string }>;
  abort(): void;
}
```

Currently implemented: `OllamaProvider`

Future providers can be added without rewriting the application.

## Authentication

- **Local accounts only** — no OAuth, no third-party dependencies
- **Argon2id** password hashing (memory-hard, resistant to GPU attacks)
- **JWT tokens** (HS256) with 30-day expiry
- **HttpOnly cookies** for secure session storage
- **Rate limiting** on auth endpoints (10 requests / 15 min)

## Chat Features

### Streaming Responses
Responses stream token-by-token via Server-Sent Events (SSE), providing immediate feedback.

### Message Actions
- **Copy**: Copy message content to clipboard
- **Regenerate**: Generate alternative response
- **Retry**: Retry failed generations

### Conversation Management
- **Auto-title**: First user message generates a descriptive title
- **Pin**: Keep important chats at top
- **Archive**: Hide without deleting
- **Search**: Full-text search across titles and messages
- **Delete**: Single or bulk with confirmation

## Settings

### Appearance
- Theme: Light / Dark / System
- Sidebar collapsed state

### Chat
- Enter to send / Shift+Enter for newline
- Show timestamps
- Auto-scroll behavior

### AI Model
- Model selection from available Ollama models
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

### Model Missing
```bash
# Pull the model
ollama pull qwen2.5:3b

# List available models
ollama list
```

### Backend Cannot Connect to Ollama
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check `OLLAMA_BASE_URL` in backend `.env`
- Ensure no firewall blocking localhost:11434

### Port Already in Use
```bash
# Change backend port
PORT=3002 npm run dev:backend

# Or change frontend port in vite.config.ts
```

### Slow Responses
- Local LLM inference speed depends on hardware
- Try smaller models (3B parameters) for faster responses
- Close other applications to free RAM

### Out of Memory
- Switch to a smaller model: `ollama pull gemma2:2b`
- Increase swap space (Linux/macOS)
- Close memory-intensive applications

## Development

### Commands

```bash
# Install all dependencies
npm install

# Development (both frontend & backend)
npm run dev

# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend

# Build all
npm run build

# Lint
npm run lint

# Type check
npm run typecheck

# Tests
npm run test

# Database
npm run db:init      # Initialize database
npm run db:migrate   # Run migrations
```

### Adding New Features

1. **New API Route**: Add to `backend/src/routes/`, register in `backend/src/app.ts`
2. **New UI Component**: Add to `frontend/src/components/` or `frontend/src/components/ui/`
3. **New Page**: Add to `frontend/src/pages/`, add route in `frontend/src/App.tsx`
4. **New AI Provider**: Implement `AIProvider` interface in `backend/src/providers/`

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier configured
- Run `npm run lint` and `npm run typecheck` before committing

## Security Considerations

- Passwords hashed with Argon2id (never stored in plaintext)
- JWT tokens signed with HS256, stored in HttpOnly cookies
- Input validation on all endpoints (Zod schemas)
- Rate limiting on sensitive endpoints
- CORS configured for frontend origin only
- SQL injection prevention via parameterized queries
- XSS prevention via DOMPurify sanitization
- No secrets in frontend code or git history

## Privacy

By default, Auron AI:
- Stores all conversations locally in SQLite
- Runs AI models locally through Ollama
- Requires no external API keys
- Sends no data to third-party services
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
- [Highlight.js](https://highlightjs.org/)
- [Argon2](https://github.com/ranisalt/node-argon2)
- [date-fns](https://date-fns.org/)

---

*Built with care for local-first AI enthusiasts.*