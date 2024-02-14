# Auron AI Screenshot Index

Every screenshot below was captured from the real, running application (frontend served by the
backend in production-static mode on `http://localhost:3002`, Ollama running locally with the
`qwen2.5:3b` model) after the UI fixes described in [ui-audit.md](ui-audit.md) were applied and
regression-tested.

Viewports used: desktop 1440×900, tablet 768×1024, mobile 390×844.

## 1. Overview

### Welcome screen — desktop, light theme

![Chat welcome screen — desktop](screenshots/01-overview/chat-welcome-desktop.png)

The first screen after signing in: conversation sidebar with pinned and recent sections, prompt
suggestion cards, message composer, and the selected model chip in the header.

### Conversation — desktop, light theme

![Conversation with code block — desktop](screenshots/01-overview/chat-conversation-desktop.png)

A rendered assistant response containing a fenced code block with a language label and copy
button, the user message bubble, and the active conversation highlighted in the sidebar.

### Welcome screen — desktop, dark theme

![Chat welcome screen — dark](screenshots/01-overview/chat-welcome-dark-desktop.png)

The same screen under the dark theme; every surface, border, and text color switches via the
design-token system.

### Conversation — desktop, dark theme

![Conversation with code block — dark](screenshots/01-overview/chat-conversation-dark-desktop.png)

Assistant code block and message layout in dark mode; code blocks keep their dark surface in
both themes.

## 2. Authentication

### Login — desktop

![Login page — desktop](screenshots/02-authentication/login-desktop.png)

The sign-in screen with the Auron AI logo, email/password fields with icons and a
show-password toggle, and a link to sign up.

### Login — validation error

![Login validation error](screenshots/02-authentication/login-validation-error.png)

Submitting the form with empty fields shows a friendly inline error ("Please enter your email
and password.") instead of the server's technical message.

### Login — mobile

![Login page — mobile](screenshots/02-authentication/login-mobile.png)

The login form at 390×844: the card scales down cleanly and all controls remain reachable.

### Sign up — desktop

![Signup page — desktop](screenshots/02-authentication/signup-desktop.png)

The account creation screen with live password requirement checks ("At least 8 characters",
"Passwords match") under the password field.

### Sign up — validation state

![Signup validation state](screenshots/02-authentication/signup-validation-state.png)

A password mismatch shows an inline field error and a form-level alert; the requirement
checklist reflects the live state.

### Sign up — mobile

![Signup page — mobile](screenshots/02-authentication/signup-mobile.png)

The signup form at mobile width; all four fields, the checklist, and the submit button remain
usable without horizontal scrolling.

## 3. Chat features

### Streaming response in progress

![Streaming response](screenshots/03-chat-features/streaming-response.png)

A response generating live: tokens appear progressively with a blinking cursor, the composer's
send button becomes a stop button, and the sidebar row shows a pulsing "generating" dot.

### Message actions revealed

![Message actions](screenshots/03-chat-features/message-actions-visible.png)

Copy and regenerate actions with the message timestamp, revealed on hover/focus beneath an
assistant message.

### Collapsed sidebar — desktop

![Collapsed sidebar](screenshots/03-chat-features/sidebar-collapsed-desktop.png)

The collapsed icon rail: conversations become icons with tooltips, the search box and labels
are hidden, and an expand button plus avatar menu stay reachable.

### Sidebar search results

![Sidebar search results](screenshots/03-chat-features/sidebar-search-results.png)

Searching chats filters titles and message content server-side; results are listed under a
"Search results" heading.

### Conversation context menu

![Conversation context menu](screenshots/03-chat-features/conversation-context-menu.png)

The per-conversation menu with Pin/Unpin, Archive/Restore, Rename, and Delete actions.

### Rename dialog

![Rename dialog](screenshots/03-chat-features/rename-conversation-dialog.png)

The rename modal with a prefilled input; saving updates the sidebar and the chat header.

### Delete confirmation

![Delete confirmation dialog](screenshots/03-chat-features/delete-conversation-dialog.png)

A destructive-action confirmation dialog naming the conversation and requiring an explicit
confirm.

### Account menu

![Account menu](screenshots/03-chat-features/account-menu-open.png)

The account menu with Profile, Settings, theme cycling, and Log out.

## 4. Settings

### Appearance

![Settings — Appearance](screenshots/04-settings/settings-appearance.png)

Theme selection (Light / Dark / System) and the "Collapsed by default" sidebar preference.

### Chat

![Settings — Chat](screenshots/04-settings/settings-chat.png)

Composer and reading preferences: Enter-to-send behavior, timestamps, and auto-scroll.

### AI Model

![Settings — AI Model](screenshots/04-settings/settings-model.png)

Model selection from installed Ollama models (with download sizes), the temperature slider, and
the custom system prompt field with a character counter.

### Data & Privacy

![Settings — Data & Privacy](screenshots/04-settings/settings-data-privacy.png)

Local-first data disclosures and the "Danger zone" for deleting all conversations.

### Delete-all confirmation

![Delete all confirmation](screenshots/04-settings/delete-all-confirm-dialog.png)

Bulk deletion requires typing the exact phrase "DELETE ALL" before the confirm button unlocks.

## 5. Profile

### Personal information

![Profile — Personal info](screenshots/05-profile/profile-personal-info.png)

Avatar, name/email editing with dirty-state Save/Reset buttons, and the member-since date.

### Password

![Profile — Password](screenshots/05-profile/profile-password.png)

Change-password form with show-password toggles, minimum-length hint, and mismatch detection.

### Sessions

![Profile — Sessions](screenshots/05-profile/profile-sessions.png)

Active session list with a "this device" badge, expiry dates, per-session revoke, and a
log-out-everywhere action.

### Danger zone

![Profile — Danger zone](screenshots/05-profile/profile-danger-zone.png)

Permanent account deletion, gated behind password confirmation.

### Delete-account dialog

![Delete account dialog](screenshots/05-profile/delete-account-dialog.png)

The password-confirmed account deletion dialog; a wrong password shows an inline error and
keeps the dialog open.

## 6. Responsive behavior

### Welcome — tablet (768×1024)

![Welcome — tablet](screenshots/06-responsive/chat-welcome-tablet.png)

Below the `lg` breakpoint the sidebar becomes an off-canvas drawer and a menu button appears in
the header.

### Welcome — mobile (390×844)

![Welcome — mobile](screenshots/06-responsive/chat-welcome-mobile.png)

Suggestion cards stack in a single column; the composer spans the full width.

### Mobile drawer open

![Mobile drawer open](screenshots/06-responsive/mobile-drawer-open.png)

The sidebar as a modal drawer with a dimmed backdrop and a close button; Escape and backdrop
taps close it.

### Conversation — mobile

![Conversation — mobile](screenshots/06-responsive/chat-conversation-mobile.png)

Messages, code blocks, and message actions adapt to the narrow viewport without overflow.

### Settings — mobile

![Settings — mobile](screenshots/06-responsive/settings-mobile.png)

Settings sections become a horizontally scrollable tab row above the content panel.
