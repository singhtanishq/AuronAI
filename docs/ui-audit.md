# Auron AI — UI/UX Audit & Frontend Corrections

This report documents the genuine issues found while testing the running application in a real
browser, and the frontend corrections applied. Every fix was verified by re-testing the affected
flows after a production rebuild, and the full quality gate (lint, typecheck, unit tests, build)
was re-run afterwards.

Testing scope: all routes (`/login`, `/signup`, `/chat`, `/chat/:conversationId`, `/settings`,
`/profile`, redirects), every meaningful interaction (streaming chat against live local Ollama,
conversation management, settings, profile/account management), and four viewport widths
(1440/1280/768/390). See [test-coverage.md](test-coverage.md) for the full test record and the
environment limitations encountered.

## Issue register

| ID | Area | Category | Severity | Status |
|----|------|----------|----------|--------|
| AUR-1 | `LoginPage` | Usability | Medium | Fixed & verified |
| AUR-2 | `ChatArea` streaming | Correctness | High | Fixed & verified |
| AUR-3 | `MessageBubble` markdown | Visual/styling | High | Fixed & verified |
| AUR-4 | `ChatArea` route handling | Error handling | Low | Fixed & verified |
| AUR-5 | `Sidebar` | Code health / performance | Low | Fixed & verified |
| AUR-6 | `services/api.ts` 401 handling | Usability (destructive flows) | Medium-High | Fixed & verified |

---

## AUR-1 — Empty login submit showed a technical error

- **Observed:** Submitting the login form with empty fields produced the raw server-side
  validation message "Invalid request body". `SignupPage` validates client-side; `LoginPage` did
  not.
- **Location:** `frontend/src/pages/LoginPage.tsx`
- **Impact:** Users hitting Enter on an empty form saw a developer-facing message.
- **Fix:** Added client-side empty-field validation mirroring the signup page convention; the
  form now shows "Please enter your email and password." without a network round-trip.
- **Verified:** Empty submit and email-only submit both show the friendly message; a real login
  still works and wrong credentials still surface the server's "Invalid email or password".

## AUR-2 — Tail of streamed responses could be silently dropped from the UI

- **Observed:** The assistant bubble rendered by the UI did not match the content stored in the
  database. In the worst observed case (generation finishing while the tab was backgrounded, so
  no animation frame ever flushed the buffer) the UI showed **no content at all** while SQLite
  held the full response; aborting a 429-character generation showed an empty bubble. Reloading
  the conversation always showed the full text.
- **Root cause:** `finalizeStream` in `ChatArea.tsx` cancels the pending `requestAnimationFrame`
  flush on `done`/`aborted`/`error` **without merging `stream.buffer` into `stream.content`**.
  Any deltas that arrived after the last animation frame (up to one frame's worth in normal use;
  the entire response when frames are suspended) were discarded from the final `updateMessage`.
- **Location:** `frontend/src/components/ChatArea.tsx`
- **Impact:** High — the visible conversation could permanently disagree with the persisted
  conversation until reload.
- **Fix:** `finalizeStream` now merges the pending buffer into the content before updating the
  message store.
- **Verified:** Sent multiple messages; the rendered content now exactly matches the database
  content at `done` time (including with animation frames suspended), and mid-stream rendering
  still works.

## AUR-3 — Markdown stylesheet never applied to assistant messages

- **Observed:** Assistant messages rendered with browser-default typography: no designed
  line-height, paragraph spacing, heading scale, list indentation, blockquote treatment, or
  inline-code styling. Only code blocks looked right (they carry their own `.code-block` styles).
- **Root cause:** The design system defines an extensive `.markdown-body` stylesheet in
  `frontend/src/styles/index.css`, and `renderMarkdown` produces sanitized HTML, but the wrapper
  `div` in `MessageBubble.tsx` never carried the `markdown-body` class. Git history confirms the
  class was never present on the component — the stylesheet was written but never wired up.
- **Location:** `frontend/src/components/MessageBubble.tsx`
- **Impact:** High — every assistant message was unstyled; long-form content was noticeably
  harder to read than designed.
- **Fix:** Added the `markdown-body` class to the assistant content wrapper.
- **Verified:** Computed line-height is now 25.5px (0.9375rem × 1.7, exactly the designed
  value); code blocks, inline code, lists, and blockquotes pick up their designed styles in both
  themes (see screenshots in [screenshot-index.md](screenshot-index.md)).

## AUR-4 — Malformed conversation IDs showed a misleading error

- **Observed:** Opening `/chat/malformed-id` (non-UUID) showed the banner "Failed to load
  conversation. Check your connection and try again." and stayed on the broken URL. The backend
  validates `:id` as a UUID, so malformed ids fail validation with **400**, while the frontend
  only redirected on **404**. Well-formed-but-unknown UUIDs already redirected correctly.
- **Location:** `frontend/src/components/ChatArea.tsx`
- **Impact:** Low — deep links with corrupted ids suggested a connection problem that did not
  exist.
- **Fix:** The conversation-load error path now treats 400 and 404 alike and returns to `/chat`
  with `replace: true`.
- **Verified:** `/chat/malformed-id-!!!` now lands on `/chat`; genuine network failures still
  show the retry banner.

## AUR-5 — Sidebar fetched the conversation list twice on mount

- **Observed:** Two identical `useEffect` blocks both called `refreshList()` when
  `isAuthenticated` became true (evident duplication from a recent edit), causing a redundant
  API request on every app load.
- **Location:** `frontend/src/components/Sidebar.tsx`
- **Fix:** Removed the duplicated effect.
- **Verified:** `npm run lint` / `tsc` clean; app loads normally with a single initial fetch per
  mount.

## AUR-6 — Wrong password in destructive dialogs signed the user out instead of showing an error

- **Observed:** Entering a wrong password in the profile "Delete account" dialog closed the
  dialog, navigated to `/login`, and showed no error. The same applied to "Change password"
  with a wrong current password.
- **Root cause:** These endpoints return **401** when the submitted password is wrong. The API
  client (`services/api.ts`) invoked its global unauthorized handler on *every* 401, which clears
  the client auth state — conflating "wrong credentials" with "expired/revoked session".
- **Location:** `frontend/src/services/api.ts`
- **Impact:** Medium-High — the user was ejected from the app mid-action with no feedback, on a
  destructive-action dialog where clear feedback matters most.
- **Fix:** The 401 handler is now skipped for credential-verification endpoints (`/auth/login`,
  `/auth/signup`, `/auth/change-password`, `/auth/account`), where a 401 means "wrong
  credentials". Genuine session revocation on all other endpoints still clears state.
- **Verified:** Wrong password in the delete-account dialog now keeps the dialog open with the
  inline "Password is incorrect" error; the full delete journey (confirm → redirect to login →
  deleted account can no longer sign in) works end-to-end.

---

## Observations verified as NOT defects

- **Sidebar collapse "applying late"** — observed once during automated testing; re-tested with
  a MutationObserver and both collapse/expand apply within 15ms. Not reproducible; the earlier
  observation was an artifact of the test environment's throttled rendering.
- **Raw markdown in conversation previews** — sidebar previews show the raw markdown of the
  last message (e.g. ``` fences) by design; previews are plain text by design.
- **Auto-title lag** — a conversation's title can update a few seconds after the first exchange
  (the title is generated by the model after the first response completes). Working as designed.

## Accessibility review

Verified against the rendered DOM (not a full WCAG audit):

- Semantic structure: `aside`/`nav`/`main` landmarks, single `h1` per page, `role="tablist"` /
  `role="tab"` with `aria-selected` for settings/profile sections, `role="log"` +
  `aria-live="polite"` on the message list, `role="alert"` on form errors, `role="switch"` with
  `aria-checked` on toggles, `role="menu"`/`menuitem` on dropdowns.
- Forms: every input has a real `<label>` association; password fields have show/hide toggles
  with accessible names; errors are announced via `role="alert"` and linked with
  `aria-describedby`.
- Keyboard: modal dialogs trap focus, restore focus on close, and close on Escape; dropdown
  menus support arrow/Home/End navigation and Escape; global shortcuts (⌘K, ⌘N, Escape) work;
  the mobile drawer closes on Escape. Focus-visible rings are styled globally.
- Reduced motion: a global `prefers-reduced-motion` rule disables animations/transitions.

## Limitations of this audit

- Hover-only styling was verified via the DOM/CSS and `focus-within` behavior rather than
  physical pointer hover (the test environment could not deliver mouse-button events — see
  [test-coverage.md](test-coverage.md)).
- The smooth-scroll animation of the "scroll to bottom" button could not be observed (smooth
  scrolling is non-functional in the test browser); the button's appearance threshold and its
  scroll target were verified with instant scrolling instead.
- Accessibility was reviewed by DOM inspection and keyboard-path reasoning; no automated
  accessibility scanner was run.
