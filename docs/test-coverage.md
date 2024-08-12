# Auron AI — Test Coverage Report

This document records the testing actually performed against the local application on
2026-10-27/28, distinguishing manual browser verification, the project's automated suites, and
static analysis. It also documents the environment limitations that shaped how browser
interactions were driven.

## Environment under test

- **App under test:** frontend + backend from this repository, run in the documented
  production-static mode — `PORT=3002 SERVE_STATIC=true` with `npm run dev:backend`, frontend
  served by the Express backend from `frontend/dist` (the default dev ports 3001/5173 were
  occupied by an unrelated project on this machine, so alternate ports were used without
  modifying any project configuration).
- **AI provider:** Ollama 0.34.0 running locally with `qwen2.5:3b` installed — live streaming
  inference was exercised end-to-end.
- **Browser:** ZCode in-app browser (Chromium-based), viewports 1440×900, 1280×800, 768×1024,
  390×844.
- **Test accounts:** a dedicated local account (`audit-test@auron.local`) was created through
  the real signup UI and used for all mutation tests; a disposable account was created and
  deleted to exercise account deletion. Pre-existing local data (the earlier "UI Tester"
  account and its two conversations) was left untouched.

### How interactions were driven (important caveat)

The test browser's input pipeline could not deliver **mouse-button events or real key events**
to the page (mouse movement arrived; clicks and key presses did not, even after fresh tabs,
visibility forcing, and coordinate/node-based fallbacks). Interactions were therefore driven by
dispatching real DOM events from page context (`element.click()`, dispatched `KeyboardEvent`,
native value setters + `input` events for controlled fields) — the same events React handles
from physical input. Consequences:

- State changes, navigation, rendering, validation, and dialogs were verified genuinely.
- Physical **hover-only** reveals (message action buttons) were verified via `focus-within`
  and CSS inspection instead of a real hover.
- **Smooth scrolling** never animates in this browser, so the "scroll to bottom" button's
  animation could not be observed; its appearance threshold and target were verified with
  instant scrolling.
- CSS transitions freeze while the pane is backgrounded, which also suspends
  `requestAnimationFrame`; this surfaced real behavior (see AUR-2 in [ui-audit.md](ui-audit.md))
  but also made several captures timing-sensitive.

## Route inventory & results

| Route | Purpose | Access | Direct nav | In-app nav | Result |
|-------|---------|--------|------------|------------|--------|
| `/` | Redirects to `/chat` | — | Redirect ✓ | — | Pass |
| `/login` | Sign in | Public (redirects to `/chat` when authed) | ✓ | via logout, links | Pass |
| `/signup` | Create account | Public (redirects to `/chat` when authed) | ✓ | via login link | Pass |
| `/chat` | New-chat welcome | Protected | ✓ (redirects to `/login` unauthed) | sidebar, ⌘N | Pass |
| `/chat/:conversationId` | Open conversation | Protected | ✓ | sidebar rows, auto-title | Pass |
| `/chat/bad-uuid` | Malformed id | Protected | redirects to `/chat` (fixed, AUR-4) | — | Pass (after fix) |
| `/chat/unknown-uuid` | Unknown id | Protected | redirects to `/chat` | — | Pass |
| `/settings` | Preferences (4 tabs) | Protected | ✓ | account menu | Pass |
| `/profile` | Account (4 tabs) | Protected | ✓ | account menu | Pass |
| `*` (unknown path) | SPA fallback | — | redirects to `/chat` | — | Pass |

Page refresh on every route renders correctly (SPA fallback + auth restore via cookie).

## Functional tests performed (manual, browser)

### Authentication
- Signup with short password → client-side error; mismatched confirm → field error + alert;
  valid signup → authenticated, redirected to `/chat`. **Pass**
- Login: empty submit → friendly client-side error (after AUR-1); email-only submit → same;
  wrong credentials → "Invalid email or password"; valid login → `/chat`. **Pass**
- Logout via account menu → `/login`, protected routes redirect. **Pass**
- Password change validation (short password error). Change-password submit itself was
  exercised for validation only (a real change would invalidate the session under test).
- Sessions page lists the current session with "this device" badge and expiry; revoke/logout-all
  controls render and are wired. **Pass (UI)**
- Account deletion: wrong password → inline "Password is incorrect", dialog stays open (after
  AUR-6); correct password → account deleted, redirect to `/login`; deleted account can no
  longer log in. **Pass** (full journey, on a disposable account)

### Chat & streaming (live local Ollama, `qwen2.5:3b`)
- Send via Enter (and via suggestion card) → conversation created, URL updates to
  `/chat/:id`, optimistic user bubble, SSE streaming renders token-by-token with blinking
  cursor, stop button replaces send, sidebar shows pulsing "generating" dot. **Pass**
- Completion → full content rendered, exactly matching the SQLite content (after AUR-2);
  auto-title generated per conversation. **Pass**
- Stop mid-generation → generation aborted, "Generation stopped — partial response kept"
  notice, partial text persisted server-side (429 chars in the DB), stop button reverts. **Pass**
  - Note: while the tab was backgrounded the *rendered* partial text could be empty due to
    AUR-2; fixed and re-verified.
- Regenerate → same message replaced with a fresh generation (verified in UI after reload and
  in DB), no duplicate messages. **Pass**
- Copy message → button flips to a success state (clipboard content could not be read back —
  browser permission restriction). **Pass (UI)**
- Code-block rendering: fenced block → dark code surface, language label, Copy button;
  highlighted tokens render for known languages. **Pass**
- Markdown rendering: styled per the design system after AUR-3 (line-height 25.5px verified
  computed). **Pass (after fix)**
- Auto-scroll follows the stream; timestamps toggle on/off takes effect. **Pass**
- ⌘K focuses search; ⌘N navigates to new chat; Escape closes drawer/overlays. **Pass**
  (keyboard events dispatched; see caveat above)
- Conversation switching: sidebar row click loads messages; unknown/bad ids redirect (AUR-4);
  refresh restores the conversation. **Pass**

### Conversation management
- Pin / Unpin → moves between Pinned and Recent, persisted (DB verified). **Pass**
- Rename via dialog → sidebar + header update, persisted. **Pass**
- Archive → leaves list, active chat navigates away; Archived section expand/collapse; Restore
  returns it. **Pass**
- Search: matches message content ("tapestry"), empty-query restore, no-match empty state.
  **Pass**
- Delete: confirm dialog, Cancel keeps, Delete removes and navigates away. **Pass**
- Delete-all (Settings → Data & Privacy): typed confirmation gates the button (empty/wrong
  phrase disabled, "DELETE ALL" enabled); dialog was cancelled to preserve test data. **Pass
  (dialog mechanics)**

### Settings
- Theme Light/Dark/System: `html.dark` class toggles instantly; dark theme verified
  visually across screens. **Pass**
- "Collapsed by default" + sidebar collapse/expand: verified applying within 15ms via
  MutationObserver (an initial "applies late" observation was an environment artifact).
  **Pass**
- Model select lists installed models with sizes; temperature slider with value display;
  system prompt saves (DB verified) and takes effect on subsequent generations. **Pass**

### Profile
- Personal info: name edit → Save → success toast, sidebar identity updates. **Pass**
- Password tab validation. **Pass** (see auth section)
- Sessions tab. **Pass** (see auth section)
- Danger zone + delete-account journey. **Pass** (see auth section)

## Responsive checks (1440 / 1280 / 768 / 390)

- Horizontal overflow: `document.scrollWidth` vs `innerWidth` measured on `/chat`, `/settings`,
  `/profile` at 1280/768/390 — **zero overflow on every combination**; no offending elements.
- Mobile drawer: off-canvas by default, menu button opens it, overlay + close button + Escape +
  backdrop click all close it; drawer geometry verified (`left === 0` when open). **Pass**
- Composer visible and usable at 390px; conversation content (bubbles, code blocks, actions)
  adapts without clipping. **Pass**
- Settings/profile navigation collapses to a horizontal tab row below `sm`. **Pass (visual)**

## Console & network observations

- A console-error collector (window `error` / `unhandledrejection` / `console.error`) was
  installed across loads: **no runtime errors or unhandled rejections** were observed during
  the entire test run.
- API failures were exercised deliberately (404/400 conversation loads, wrong credentials,
  wrong-password deletion); each produced designed, user-visible feedback (after AUR-4/AUR-6).

## Automated suites & static analysis (executed)

| Check | Command | Result |
|-------|---------|--------|
| Frontend lint | `npm run lint:frontend` | 0 errors, 0 warnings |
| Backend lint | `npm run lint:backend` | 0 errors, 37 pre-existing `no-explicit-any` warnings (backend test files only) |
| Frontend typecheck | `npm run typecheck:frontend` | Clean |
| Backend typecheck | `npm run typecheck:backend` | Clean |
| Frontend unit tests (Vitest) | `npm run test:frontend` | 2 files, **23/23 pass** (SSE parser, markdown sanitization, formatting) |
| Backend tests (Vitest) | `npm run test:backend` | 4 files, **49/49 pass** (auth, chat service, migrations, HTTP API) |
| Production build | `npm run build` | Both workspaces build cleanly |

All checks were re-run after the final code change and pass. The 37 lint warnings are
pre-existing (backend test files, `@typescript-eslint/no-explicit-any`), were present before any
changes, and were intentionally left untouched (backend-only, warning-level).

## Known limitations / not verified

- **Live model quality** is whatever `qwen2.5:3b` produces on this machine; the tests verified
  plumbing and UI, not model quality. No other models were tested.
- **Change-password submit** and **logout-all/revoke-session** were UI-verified and
  code-reviewed but not fully executed, to avoid invalidating the session under test mid-run.
- **Clipboard write** could not be read back (browser permission); the copy action's UI
  feedback was verified instead.
- **Hover-only styling** and **smooth-scroll animation** — see the caveat at the top.
- Multi-tab/multi-device scenarios (two browsers sharing one account) were not tested.
- Rate limiting (300 req/15 min, 20 auth attempts/15 min) was not load-tested.
- Accessibility was reviewed by DOM/keyboard-path inspection (see ui-audit.md), not with an
  automated audit tool.

## Regression testing after fixes

After each fix the affected flow was re-tested in the rebuilt production bundle (static serving
picks up `frontend/dist` immediately; `index.html` is revalidated via ETag). Additionally the
complete route inventory and the streaming/abort/regenerate flows were re-walked after the final
build. No regressions were introduced; the only behavioral changes are the six fixes documented
in [ui-audit.md](ui-audit.md).
