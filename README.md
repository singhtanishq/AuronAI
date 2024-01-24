# Auron AI

A locally runnable, open-source AI chatbot powered by Ollama.

**Auron AI** — Powered by Tanishq Singh

## Overview

Auron AI is a modern, privacy-friendly, local-first AI assistant that runs entirely on your
machine. It uses locally hosted open-weight language models through Ollama, ensuring your
conversations never leave your device. Sign in, pick any model installed in your local Ollama,
and chat — responses stream in real time over Server-Sent Events while the full conversation is
persisted to a local SQLite database.

## Highlights

- **Local-first architecture** — all AI inference runs locally via Ollama: no API keys, no
  cloud calls, no telemetry, no remote fonts or CDNs
- **Real-time streaming** — responses stream token-by-token over SSE with requestAnimationFrame
  batching, a blinking cursor, and a working stop button that preserves partial output
- **Conversation management** — persistent history with server-side search across titles and
  message content, pin, rename, archive/restore, single and bulk delete with typed confirmation
- **Auto-titling** — the first exchange generates a descriptive conversation title
- **Accounts & sessions** — local accounts with Argon2id password hashing, opaque HttpOnly
  session cookies, session listing/revocation, and password-confirmed account deletion
- **Markdown that renders properly** — sanitized GFM with headings, lists, tables, blockquotes,
  and syntax-highlighted code blocks with per-block copy buttons
- **Themes** — light, dark, and system-follow, applied pre-paint from design tokens
- **Responsive** — sidebar collapses to an icon rail on desktop and a drawer on mobile; verified
  from 1440px down to 390px with zero horizontal overflow
- **Keyboard support** — ⌘/Ctrl+K to search, ⌘/Ctrl+N for a new chat, Escape to close overlays,
  full dialog focus trapping, reduced-motion support

---

# Visual Documentation

The 33 screenshots below were captured from the real, running application (frontend served by
the backend in production-static mode, Ollama running locally with the `qwen2.5:3b` model) after
the UI fixes described in [docs/ui-audit.md](docs/ui-audit.md) were applied and
regression-tested. They are numbered 1–33 and grouped by module, page, and workflow.

## Chat Interface & Overview

### 1. Chat Welcome Screen — Desktop, Light Theme

The first screen after signing in: the conversation sidebar with pinned and recent sections,
six prompt suggestion cards, the selected model chip (`qwen2.5:3b`) in the header, and the
message composer with its Enter-to-send hint.

![Chat welcome screen — desktop, light theme](docs/screenshots/01-overview/chat-welcome-desktop.png)

### 2. Conversation With Rendered Code Block — Desktop, Light Theme

An opened conversation: the user's message in a right-aligned teal bubble, and the assistant
reply rendered as sanitized markdown — here a fenced code block on a dark surface with a
language label and its own Copy button. The active conversation is highlighted in the sidebar.

![Conversation with rendered code block — desktop, light theme](docs/screenshots/01-overview/chat-conversation-desktop.png)

### 3. Chat Welcome Screen — Desktop, Dark Theme

The same welcome screen under the dark theme: every surface, border, and text color switches
through the variable-backed design-token system, while the teal accent identity is preserved.

![Chat welcome screen — desktop, dark theme](docs/screenshots/01-overview/chat-welcome-dark-desktop.png)

### 4. Conversation With Code Block — Desktop, Dark Theme

The conversation view in dark mode. Code blocks intentionally keep their dark surface in both
themes; message bubbles, the sidebar, and the composer all adapt to the dark palette.

![Conversation with code block — desktop, dark theme](docs/screenshots/01-overview/chat-conversation-dark-desktop.png)

## Authentication

### 5. Login Page — Desktop

The sign-in screen with the Auron AI logo, icon-prefixed email and password fields (with a
show-password toggle), the primary Sign in button, and a link to create an account.

![Login page — desktop](docs/screenshots/02-authentication/login-desktop.png)

### 6. Login Validation Error

Submitting the form with empty fields shows a friendly inline alert — "Please enter your email
and password." — instead of the server's technical validation message.

![Login validation error](docs/screenshots/02-authentication/login-validation-error.png)

### 7. Signup Page — Desktop

The account creation screen: name, email, password, and confirm-password fields, with a live
requirement checklist ("At least 8 characters", "Passwords match") under the password input.

![Signup page — desktop](docs/screenshots/02-authentication/signup-desktop.png)

### 8. Signup Validation State

The checklist reflects live input: the length requirement is satisfied (green check) while a
mismatched confirmation shows the red "Passwords do not match" field error and a red input
border.

![Signup validation state](docs/screenshots/02-authentication/signup-validation-state.png)

### 9. Login Page — Mobile (390×844)

At mobile width the login card scales down cleanly — icon inputs, password toggle, and the
sign-up link all remain reachable with no horizontal scrolling.

![Login page — mobile](docs/screenshots/02-authentication/login-mobile.png)

### 10. Signup Page — Mobile (390×844)

The signup form on a narrow viewport: all four fields, the requirement checklist, and the
submit button stack vertically and stay fully usable.

![Signup page — mobile](docs/screenshots/02-authentication/signup-mobile.png)

## Chat Features & Workflows

### 11. Live Streaming Response

A response generating in real time from local Ollama: tokens appear progressively with a
blinking cursor, the composer's send button has become a stop button, the active sidebar row
shows a pulsing "generating" dot, and auto-scroll follows the stream.

![Live streaming response](docs/screenshots/03-chat-features/streaming-response.png)

### 12. Message Actions — Copy, Regenerate, Timestamp

The action row revealed beneath a completed assistant message (on hover or keyboard focus):
copy the message, regenerate the response, and the message timestamp.

![Message actions — copy, regenerate, timestamp](docs/screenshots/03-chat-features/message-actions-visible.png)

### 13. Collapsed Sidebar Rail

With the sidebar collapsed, conversations become an icon rail (pinned conversations keep their
pin icon), the active one is highlighted, and an expand button plus the account avatar stay at
the bottom.

![Collapsed sidebar rail](docs/screenshots/03-chat-features/sidebar-collapsed-desktop.png)

### 14. Sidebar Search

The search box filters conversations server-side across titles and message content — here the
query "quantum" is in flight and the list shows the loading skeletons under the "Search
results" heading.

![Sidebar search results](docs/screenshots/03-chat-features/sidebar-search-results.png)

### 15. Conversation Context Menu

The per-conversation options menu opened from a sidebar row: Unpin, Archive, Rename, and a red
Delete action, each with its icon.

![Conversation context menu](docs/screenshots/03-chat-features/conversation-context-menu.png)

### 16. Rename Conversation Dialog

The rename modal with the current title prefilled; saving updates the sidebar row and the chat
header, with Cancel and Save actions.

![Rename conversation dialog](docs/screenshots/03-chat-features/rename-conversation-dialog.png)

### 17. Delete Conversation Confirmation

Destructive actions are confirmed: the dialog names the exact conversation ("Quantum basics in
simple terms") and states that all of its messages will be permanently deleted, over a dimmed
backdrop.

![Delete conversation confirmation](docs/screenshots/03-chat-features/delete-conversation-dialog.png)

### 18. Account Menu

The menu opened from the sidebar avatar: Profile, Settings, theme cycling ("Theme: light"),
and a red Log out action.

![Account menu open](docs/screenshots/03-chat-features/account-menu-open.png)

## Settings

### 19. Settings — Appearance

Theme selection as three selectable cards (Light selected, Dark, System) plus the "Collapsed
by default" sidebar preference, which syncs to the account.

![Settings — Appearance](docs/screenshots/04-settings/settings-appearance.png)

### 20. Settings — Chat Preferences

Composer and reading behavior: "Enter to send", "Show timestamps", and "Auto-scroll" toggles,
each with a plain-language description.

![Settings — Chat preferences](docs/screenshots/04-settings/settings-chat.png)

### 21. Settings — AI Model

Model selection from the locally installed Ollama models with download sizes
(`qwen2.5:3b · 1.9 GB`), the temperature slider (0.7, from Precise to Creative), and the custom
system prompt field with a live character counter.

![Settings — AI Model](docs/screenshots/04-settings/settings-model.png)

### 22. Settings — Data & Privacy

The local-first data disclosures (stored on this machine, local inference, no telemetry, you
control deletion) and the red "Danger zone" card for deleting all conversations.

![Settings — Data & Privacy](docs/screenshots/04-settings/settings-data-privacy.png)

### 23. Delete-All Confirmation Dialog

Bulk deletion requires typing the exact phrase "DELETE ALL" before the red "Delete everything"
button unlocks — an accidental click cannot wipe history.

![Delete-all confirmation dialog](docs/screenshots/04-settings/delete-all-confirm-dialog.png)

## Profile & Account Management

### 24. Profile — Personal Information

The avatar with computed initials, editable name and email, dirty-state Reset and Save changes
buttons, and the member-since date.

![Profile — Personal information](docs/screenshots/05-profile/profile-personal-info.png)

### 25. Profile — Change Password

The change-password form with three password fields (each with a show-password toggle), the
"Changing your password signs you out on all devices" warning, and a minimum-length hint. The
submit button stays disabled until the fields are valid.

![Profile — Change password](docs/screenshots/05-profile/profile-password.png)

### 26. Profile — Active Sessions

Every signed-in session with a device icon, a green "this device" badge on the current
session, its expiry date, a per-session Log out action, and a separate "Log out of all
devices" control.

![Profile — Active sessions](docs/screenshots/05-profile/profile-sessions.png)

### 27. Profile — Danger Zone

The permanent account-deletion card: a red-bordered panel naming the account to be removed,
with the red "Delete account…" trigger.

![Profile — Danger zone](docs/screenshots/05-profile/profile-danger-zone.png)

### 28. Delete Account Confirmation Dialog

The password-gated deletion dialog; the red "Delete account" button stays disabled until a
password is entered, and a wrong password shows an inline error while keeping the dialog open.

![Delete account confirmation dialog](docs/screenshots/05-profile/delete-account-dialog.png)

## Responsive Design

The application was verified at 1440×900, 1280×800, 768×1024, and 390×844 with zero horizontal
overflow on every page. Below the `lg` breakpoint the sidebar becomes an off-canvas drawer
opened from the header menu button; settings and profile navigation collapses to a horizontal
tab row.

### 29. Welcome Screen — Tablet (768×1024)

At tablet width the sidebar is hidden and the header shows the hamburger menu button; the
suggestion cards keep their two-column grid and the model chip stays visible.

![Welcome screen — tablet](docs/screenshots/06-responsive/chat-welcome-tablet.png)

### 30. Welcome Screen — Mobile (390×844)

At mobile width the suggestion cards stack in a single column and the composer remains pinned
to the bottom of the viewport.

![Welcome screen — mobile](docs/screenshots/06-responsive/chat-welcome-mobile.png)

### 31. Mobile Sidebar Drawer Open

The sidebar rendered as a modal drawer over a dimmed backdrop, with a close button in the
header; Escape and backdrop taps close it.

![Mobile sidebar drawer open](docs/screenshots/06-responsive/mobile-drawer-open.png)

### 32. Conversation — Mobile (390×844)

Messages, the rendered code block with its copy button, the message action row, and the
full-width composer all adapt to the narrow viewport without clipping.

![Conversation — mobile](docs/screenshots/06-responsive/chat-conversation-mobile.png)

### 33. Settings — Mobile (390×844)

The settings sections become a horizontally arranged tab row (Appearance, Chat, AI Model,
Data & Privacy) above the content panel; theme cards and toggles remain fully usable.

![Settings — mobile](docs/screenshots/06-responsive/settings-mobile.png)

---

## Application Routes

| Route | Page | Purpose | Access |
|-------|------|---------|--------|
| `/` | — | Redirects to `/chat` | Public |
| `/login` | LoginPage | Sign in | Public; redirects to `/chat` when already signed in |
| `/signup` | SignupPage | Create a local account | Public; redirects to `/chat` when already signed in |
| `/chat` | ChatArea | Welcome screen + composer for a new conversation | Protected |
| `/chat/:conversationId` | ChatArea | An existing conversation | Protected; unknown or malformed ids redirect to `/chat` |
| `/settings` | SettingsPage | Appearance, Chat, AI Model, Data & Privacy | Protected |
| `/profile` | ProfilePage | Personal info, Password, Sessions, Danger zone | Protected |
| `*` | — | Unknown paths redirect to `/chat` | — |

## Technology Stack

**Frontend:**
- React 18 + TypeScript, built with Vite
- Tailwind CSS with a semantic, variable-backed design-token system
- Zustand for state management (with persisted UI/auth/settings slices)
- React Router 6 for navigation
- Marked + DOMPurify for sanitized markdown; Highlight.js for syntax highlighting
- Lucide React icons; Vitest for unit tests

**Backend:**
- Node.js (20+) + Express + TypeScript
- Better-SQLite3 with a versioned migration runner
- Argon2id password hashing; opaque server-side sessions stored as SHA-256 hashes
- Server-Sent Events for streaming; Zod validation; express-rate-limit

**AI Provider:**
- Ollama behind a provider abstraction (`generate` / `stream` / `listModels` / `healthCheck`)
- Any Ollama-compatible model; per-generation abort handling with idle and overall timeouts

## Architecture

```mermaid
flowchart TD
    A[index.html entry] --> B[React Router]
    B --> C{Auth guard}
    C -->|public| D[Login / Signup]
    C -->|protected| E[MainLayout: Sidebar + Outlet]
    E --> F[ChatArea]
    E --> G[SettingsPage]
    E --> H[ProfilePage]
    F --> I[Zustand stores<br/>conversations · chat · settings · UI]
    D --> J[AuthContext]
    I --> K[API client + SSE parser]
    K -->|REST + SSE over cookie session| L[Express backend]
    L --> M[(SQLite<br/>auron.db)]
    L -->|HTTP| N[Ollama]
    N --> O[Local LLM]
```

The backend is the only stateful tier: every conversation, message, preference, and session row
lives in SQLite, and every generation request is forwarded to the locally installed Ollama. The
frontend holds no tokens — authentication rides an HttpOnly cookie, and session restoration asks
the server (`GET /api/auth/me`).

```
AuronAI/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # Chat, sidebar, and UI primitives (ui/)
│   │   ├── pages/            # Login, signup, settings, profile
│   │   ├── contexts/         # Auth, Theme
│   │   ├── stores/           # Zustand stores
│   │   ├── services/         # API client + SSE reader
│   │   ├── utils/            # Markdown pipeline, SSE parser, formatting (+ tests)
│   │   ├── styles/           # Design tokens and global styles
│   │   ├── App.tsx           # Routes and app shell
│   │   └── main.tsx          # Entry point
│   └── vite.config.ts
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
│   │   ├── app.ts            # Express app setup
│   │   └── server.ts         # Entry point (graceful shutdown)
│   └── data/                 # SQLite database (created at runtime)
│
├── docs/                     # Architecture, development guide, screenshots, audits
├── package.json              # Root workspace config
└── README.md
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

Exactly one assistant message is created per submission; `delta` events append to it, and
partial output is flushed to SQLite while streaming and preserved with an `aborted` or `error`
status if generation stops early.

## Requirements

### Hardware
- Modern CPU (Apple Silicon or modern x86), ~8 GB RAM minimum, 2–10 GB free disk for models
- 16 GB+ RAM recommended for larger models

### Software
- Node.js 20+
- Ollama ([ollama.com](https://ollama.com/download)) with at least one model pulled
- Any modern browser

## Installation

```bash
# 1. Install dependencies for both workspaces
npm install

# 2. Install Ollama and pull a model
brew install ollama          # macOS (see ollama.com for other platforms)
ollama pull qwen2.5:3b       # lightweight default; any installed model works

# 3. Configure environment (optional — defaults work out of the box)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Default configuration: backend `http://localhost:3001`, frontend dev server
`http://localhost:5173`, Ollama `http://localhost:11434`, default model `qwen2.5:3b`.

## Running the Application

```bash
# Development (frontend + backend concurrently)
npm run dev

# Or separately
npm run dev:backend   # Express + SQLite on :3001
npm run dev:frontend  # Vite dev server on :5173 (proxies /api to :3001)
```

Then open **http://localhost:5173** and create your local account.

### Production mode

```bash
npm run build   # builds frontend and backend
npm run start   # serves the API and the compiled frontend from one port
```

With `NODE_ENV=production`, the backend serves the compiled frontend from `frontend/dist`
(configurable via `STATIC_ROOT`), handles SPA routing, and returns JSON 404s for unknown
`/api/*` routes. This mode was used for the full verification pass documented in
[docs/test-coverage.md](docs/test-coverage.md).

## Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Run backend + frontend dev servers concurrently |
| `npm run build` | Build frontend and backend |
| `npm run start` | Start the production backend (serves the built frontend) |
| `npm run lint` / `lint:frontend` / `lint:backend` | ESLint |
| `npm run typecheck` / `typecheck:frontend` / `typecheck:backend` | `tsc --noEmit` |
| `npm run test` / `test:frontend` / `test:backend` | Vitest suites |
| `npm run db:init` / `db:migrate` | Initialize / migrate the database (also automatic on startup) |

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | `production` enables secure cookies + static serving |
| `SERVE_STATIC` | — | Set `true` to serve `frontend/dist` even in development |
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

> **No session secret is required.** Sessions are opaque random tokens stored only as SHA-256
> hashes in the database and delivered in an HttpOnly cookie.

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE` | `/api` | API base path (proxied in dev) |

## User Workflows

### First run → first chat
1. Start Ollama and the app; open the frontend and create an account on `/signup` (password
   requirements are checked live).
2. You land on `/chat`: the welcome screen offers prompt suggestions; sending one creates the
   conversation, updates the URL to `/chat/:id`, and streams the response token-by-token.
3. The first exchange generates a conversation title, and the sidebar fills with your history.

### Managing history
- **Search** (⌘K) matches titles and message content server-side.
- **Pin** keeps conversations at the top; **Archive** hides them under a collapsible section;
  **Rename** opens a dialog; **Delete** (single or "delete all" with a typed confirmation)
  requires explicit confirmation.

### Tuning the assistant
- Settings → **AI Model** lists every installed Ollama model with its download size; pick one,
  adjust temperature, and add a custom system prompt (applied to new messages in every
  conversation).
- Settings → **Chat** controls Enter-to-send, timestamps, and auto-scroll.
- Settings → **Appearance** switches light/dark/system theme and the default sidebar state;
  both sync to your account.

### Account hygiene
- Profile → **Sessions** shows every signed-in session with a "this device" badge; revoke any
  of them or log out everywhere.
- Profile → **Danger zone** deletes the account permanently after password confirmation; a
  wrong password shows an inline error and keeps the dialog open.

### When Ollama is offline
The chat screen shows a persistent banner with a Retry button while Ollama is unreachable, and
the composer placeholder changes to hint at `ollama serve`. Conversation history stays readable,
and the health check auto-retries every 20s and on window focus.

## Testing & Quality

The project ships two Vitest suites (backend 49 tests: auth, chat service, migrations, HTTP API;
frontend 23 tests: SSE parser, markdown sanitization, formatting) plus ESLint and strict
TypeScript across both workspaces.

A full audit pass — every route, interaction, live streaming against local Ollama, four
viewports, and a UI/UX review with six frontend fixes — is documented here:

- [docs/test-coverage.md](docs/test-coverage.md) — what was tested and what was not
- [docs/ui-audit.md](docs/ui-audit.md) — issues found and fixes applied
- [docs/screenshot-index.md](docs/screenshot-index.md) — per-image captions for the gallery
  embedded above
- [docs/architecture.md](docs/architecture.md) · [docs/development.md](docs/development.md) —
  deeper architecture and development notes

## Known Limitations

- Model response quality and speed depend entirely on your hardware and the pulled model.
- Uploads, RAG, voice, image input, and tool calling are **not implemented** (see roadmap).
- The production-static mode sets `Secure` cookies — use `localhost` or HTTPS.
- Rate limits and multi-device concurrent sessions are configured but not load-tested.

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

## Development

```bash
npm install          # install all dependencies
npm run dev          # both dev servers
npm run test         # all Vitest suites
npm run lint         # ESLint (both workspaces)
npm run typecheck    # tsc --noEmit (both workspaces)
npm run build        # production build
```

Backend tests run against a disposable temp database with a scripted mock AI provider, so they
never touch a real user database. Run `npm run lint && npm run typecheck && npm run test`
before committing. TypeScript strict mode is enabled in both workspaces.

## Security & Privacy

- Passwords hashed with Argon2id; opaque session tokens stored as SHA-256 hashes in HttpOnly,
  SameSite=Lax cookies (Secure in production)
- Every conversation, message, and generation enforces per-user ownership at the service layer
- Zod input validation on all endpoints; rate limiting on auth and generation endpoints
- SQL injection prevention via parameterized queries; XSS prevention via DOMPurify-sanitized
  markdown (script tags, event handlers, and `javascript:` URLs stripped; external links get
  `rel="noopener noreferrer nofollow"`)
- No tokens in localStorage; no telemetry, analytics, third-party requests, remote fonts, or
  CDNs — once models are downloaded, the app works fully offline
- Production error responses hide internal details; graceful shutdown aborts in-flight
  generations and closes the database

## Database Migrations

The backend applies versioned migrations automatically on startup and records them in a
`schema_migrations` table — startup is repeatable and safe. To run or verify migrations
explicitly:

```bash
npm run db:migrate   # applies pending migrations, prints the schema version
npm run db:init      # initializes a fresh database (also automatic)
```

Migrations are backward-compatible and never delete data.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Ollama not reachable banner | `ollama serve` (or `brew services start ollama`), then Retry |
| Model missing | `ollama pull qwen2.5:3b`; Auron falls back to the first installed model and tells you |
| Backend can't reach Ollama | `curl http://localhost:11434/api/tags`; check `OLLAMA_BASE_URL` |
| Port already in use | `PORT=3002 npm run dev:backend`, or change the Vite port/proxy in `frontend/vite.config.ts` |
| Slow responses | Try a smaller model (3B); local inference speed depends on your hardware |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests and linting: `npm run test && npm run lint && npm run typecheck`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

## Credits

**Auron AI** — Powered by Tanishq Singh.

Built with:
- [React](https://react.dev/) · [Vite](https://vitejs.dev/) · [Tailwind CSS](https://tailwindcss.com/)
- [Express](https://expressjs.com/) · [Better-SQLite3](https://github.com/WiseLibs/better-sqlite3) · [Ollama](https://ollama.com/)
- [Zustand](https://github.com/pmndrs/zustand) · [Lucide Icons](https://lucide.dev/)
- [Marked](https://marked.js.org/) · [DOMPurify](https://github.com/cure53/DOMPurify) · [Highlight.js](https://highlightjs.org/)
- [Argon2](https://github.com/ranisalt/node-argon2)

---

*Built with care for local-first AI enthusiasts.*
