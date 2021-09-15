# Auron AI Architecture Documentation

## Overview

This document describes the architecture of Auron AI, a locally runnable AI chatbot application.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Machine                           │
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │   Frontend       │    │   Backend        │                 │
│  │   (React + TS)   │◄──►│   (Express + TS) │                 │
│  │   Port: 5173     │    │   Port: 3001     │                 │
│  └──────────────────┘    └────────┬─────────┘                 │
│                                   │                            │
│                    ┌──────────────┴──────────────┐             │
│                    │                             │             │
│            ┌───────┴───────┐             ┌───────┴───────┐    │
│            │  SQLite DB    │             │    Ollama     │    │
│            │  (auron.db)   │             │  (Local LLM)  │    │
│            └───────────────┘             └───────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App
├── ThemeProvider
├── AuthProvider
├── TooltipProvider
├── ToastProvider
└── Router
    ├── Public Routes
    │   ├── /login → LoginPage
    │   └── /signup → SignupPage
    └── Protected Routes (MainLayout)
        ├── Sidebar
        ├── /chat → ChatArea
        ├── /chat/:id → ChatArea
        ├── /settings → SettingsPage
        └── /profile → ProfilePage
```

### State Management (Zustand Stores)

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `useAuthStore` | User auth state, token | localStorage |
| `useConversationStore` | Conversations, messages, active chat | Memory |
| `useSettingsStore` | User preferences, models, Ollama health | localStorage (prefs only) |
| `useUIStore` | Sidebar, theme, toasts, modals | localStorage (sidebar, theme) |
| `useChatStore` | Generation state, abort controller | Memory |

### Key Components

**ChatArea** (`components/ChatArea.tsx`)
- Main chat interface
- Handles message streaming via SSE
- Manages scroll behavior (auto-scroll when at bottom)
- Error handling and retry logic

**MessageBubble** (`components/MessageBubble.tsx`)
- Renders individual messages
- Markdown + syntax highlighting (marked + highlight.js)
- Action buttons (copy, regenerate, dropdown menu)

**MessageComposer** (`components/MessageComposer.tsx`)
- Auto-resizing textarea
- Enter to send, Shift+Enter for newline
- Stop generation button during streaming

**Sidebar** (`components/Sidebar.tsx`)
- Collapsible with smooth animation
- Conversation list (pinned + recent)
- Search, new chat, user menu
- Mobile drawer support

**Welcome** (`components/Welcome.tsx`)
- Empty state with prompt suggestions
- Clickable prompt cards

### Contexts

**ThemeContext** - Theme state (light/dark/system) with system preference detection
**AuthContext** - Authentication state and methods (login, signup, logout, etc.)

## Backend Architecture

### Module Structure

```
src/
├── config/          # Configuration (env-based)
├── controllers/     # Request handlers (not used - logic in routes)
├── routes/          # API route definitions
│   ├── auth.ts         # Authentication endpoints
│   ├── conversations.ts # Conversation CRUD
│   ├── ai.ts           # Chat/streaming endpoints
│   ├── settings.ts     # User preferences
│   └── health.ts       # Health checks
├── services/        # Business logic
│   ├── authService.ts    # Auth operations
│   └── chatService.ts    # Chat orchestration
├── providers/       # AI provider abstraction
│   ├── aiProvider.ts     # Base interface
│   └── ollamaProvider.ts # Ollama implementation
├── repositories/    # Data access layer
│   ├── userRepository.ts
│   ├── conversationRepository.ts
│   ├── messageRepository.ts
│   └── preferencesRepository.ts
├── middleware/      # Express middleware
│   ├── auth.ts           # JWT authentication
│   ├── validation.ts     # Zod schema validation
│   └── errorHandler.ts   # Error handling
├── database/        # SQLite setup
│   ├── index.ts          # Connection + schema
│   └── init.ts           # Initialization script
├── types/           # Shared TypeScript types
├── prompts/         # System prompts
└── utils/           # Utilities (logger)
```

### Request Flow

```
1. Frontend: User sends message
2. POST /api/ai/chat (with conversationId, message, model, temperature, systemPrompt)
3. Backend: authMiddleware validates JWT
4. Backend: Creates/retrieves conversation
5. Backend: Saves user message to DB
6. Backend: Creates assistant message placeholder (streaming)
7. Backend: Builds context (recent messages + system prompt)
8. Backend: Calls OllamaProvider.stream()
9. Ollama: Returns streaming response
10. Backend: Forwards chunks via SSE to frontend
11. Frontend: Renders chunks incrementally
12. Backend: On complete, updates message status, token count, generation time
13. Backend: Updates conversation timestamp
14. Backend: Auto-generates title if first exchange
```

### Database Schema

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_color TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Conversations
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  pinned INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  status TEXT CHECK (status IN ('pending', 'streaming', 'completed', 'error', 'aborted')) DEFAULT 'completed',
  token_count INTEGER,
  generation_time_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- User Preferences
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'system',
  sidebar_collapsed INTEGER DEFAULT 0,
  enter_to_send INTEGER DEFAULT 1,
  show_timestamps INTEGER DEFAULT 1,
  auto_scroll INTEGER DEFAULT 1,
  model TEXT DEFAULT 'qwen2.5:3b',
  temperature REAL DEFAULT 0.7,
  system_prompt TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Indexes

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_pinned ON conversations(user_id, pinned DESC, updated_at DESC);
CREATE INDEX idx_conversations_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(conversation_id, created_at);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

### Triggers

Auto-update timestamps on record modification.

## AI Provider Abstraction

### Interface

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

### OllamaProvider Implementation

- **Base URL**: Configurable via `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
- **Streaming**: Uses `/api/chat` with `stream: true`
- **Model Listing**: Uses `/api/tags`
- **Health Check**: Uses `/api/tags` with 5s timeout
- **Abort**: Uses AbortController for request cancellation

### ChatRequest

```typescript
interface ChatRequest {
  conversationId?: string;
  message: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}
```

### StreamChunk

```typescript
interface StreamChunk {
  type: 'content' | 'done' | 'error' | 'complete';
  content?: string;
  messageId?: string;
  conversationId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  error?: string;
}
```

## Authentication

### Password Hashing

- Algorithm: Argon2id
- Memory cost: 64 MB (2^16)
- Time cost: 3 iterations
- Parallelism: 1

### Session Management

- JWT tokens (HS256)
- 30-day expiration
- Stored in HttpOnly, Secure, SameSite=Lax cookies
- Token hash stored in database (not raw token)
- Sessions cleaned up periodically

### Rate Limiting

- General API: 100 requests / 15 minutes
- Auth endpoints: 10 requests / 15 minutes

## Streaming Implementation

### Server-Sent Events (SSE)

Backend uses SSE for streaming responses:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"content","content":"Hello","messageId":"msg_123","conversationId":"conv_456"}

data: {"type":"content","content":" world","messageId":"msg_123","conversationId":"conv_456"}

data: {"type":"done","messageId":"msg_123","conversationId":"conv_456"}

data: {"type":"complete","conversationId":"conv_456","userMessageId":"msg_789","assistantMessageId":"msg_123"}
```

### Frontend Consumption

```typescript
const response = await fetch('/api/ai/chat', { ... });
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const chunk = JSON.parse(line.slice(6));
      onChunk(chunk);
    }
  }
}
```

## Security

### Input Validation

All external input validated with Zod schemas:
- Auth: email format, password strength, name length
- Conversations: UUID validation, title length
- Chat: message length (max 50k chars), temperature range
- Settings: enum validation, numeric ranges

### Error Handling

- No stack traces in production responses
- Generic error messages for auth (prevents user enumeration)
- Structured error codes for frontend handling

### CORS

Configured for frontend origin only with credentials.

## Performance Considerations

### Database

- WAL mode for concurrent reads/writes
- Indexes on frequently queried columns
- Connection pooling via better-sqlite3 (single connection)
- Message history limited to 20 recent for context

### Frontend

- Virtualized lists not needed (conversation count typically small)
- Memoization where beneficial
- Debounced search (handled by backend)
- Lazy loading not needed (single-page app)

### Streaming

- Chunked transfer avoids large memory buffers
- AbortController for cancellation
- Token count estimated (chars/4) for display

## Deployment

### Development

```bash
npm run dev  # Runs both frontend (5173) and backend (3001)
```

### Production

```bash
npm run build    # Builds both frontend and backend
npm run start    # Starts backend (serves frontend dist)
```

Backend serves frontend static files from `frontend/dist/`.

### Docker (Optional)

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY frontend ./frontend
COPY backend ./backend
RUN npm install
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/backend/package.json ./backend/
RUN cd backend && npm ci --production
EXPOSE 3001
CMD ["node", "backend/dist/server.js"]
```

## Testing

### Backend Tests

```bash
cd backend && npm run test
```

Tests cover:
- Auth validation
- Conversation CRUD
- Chat title generation
- Health endpoints

### Frontend Tests

```bash
cd frontend && npm run test
```

## Monitoring & Logging

### Backend Logger

Structured logging with levels: debug, info, warn, error

Logs:
- Server startup
- Database readiness
- Ollama connectivity
- Auth failures (without sensitive data)
- AI provider failures

### Health Endpoints

- `GET /api/health` - Overall system health
- `GET /api/health/ai` - Ollama connectivity
- `GET /api/health/models` - Available models

## Future Extensibility

The architecture supports:
- Additional AI providers (implement `AIProvider`)
- New API versions (route prefixing)
- WebSocket support (replace SSE)
- Plugin system (middleware + provider hooks)
- Multi-user deployments (already supported)