import { ensureTestDb, resetTestData } from './setup';
import { createApp } from '../app';
import { setAIProvider, resetAIProvider } from '../providers';
import type { AIProvider } from '../providers/aiProvider';
import type { ChatRequest, ModelInfo, ProviderHealth, StreamChunk, StreamResult } from '../types';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

/** Minimal SSE frame parser for tests: extracts data-frame JSON payloads. */
function parseSse(text: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const frame of text.split(/\r?\n\r?\n/)) {
    const dataLines = frame.split(/\r?\n/).filter((line) => line.startsWith('data:'));
    if (dataLines.length === 0) continue;
    try {
      events.push(JSON.parse(dataLines.map((l) => l.slice(5).trim()).join('\n')));
    } catch {
      // ignore malformed frames
    }
  }
  return events;
}

class ScriptedProvider implements AIProvider {
  name = 'mock';
  scripts: Array<{ chunks: string[]; result: StreamResult }> = [];
  requests: ChatRequest[] = [];

  queue(chunks: string[], result: StreamResult): void {
    this.scripts.push({ chunks, result });
  }

  async generate(request: ChatRequest): Promise<string> {
    this.requests.push(request);
    return 'A Generated Title';
  }

  async stream(request: ChatRequest, onChunk: (chunk: StreamChunk) => void, _signal?: AbortSignal): Promise<StreamResult> {
    this.requests.push(request);
    const script = this.scripts.shift();
    if (!script) return { status: 'error', content: '', error: 'No script' };
    for (const chunk of script.chunks) onChunk({ type: 'content', content: chunk });
    return { ...script.result, content: script.chunks.join('') };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [{ name: 'mock-model', modifiedAt: '2026-01-01T00:00:00Z', size: 4_000_000_000, digest: 'abc' }];
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { reachable: true, models: 1, defaultModel: 'mock-model' };
  }
}

async function readSse(response: globalThis.Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  return parseSse(text);
}

describe('HTTP API', () => {
  let server: Server;
  let baseUrl: string;
  let provider: ScriptedProvider;

  const users: Array<{ cookie: string; id: string; email: string }> = [];

  async function signupUser(name: string): Promise<{ cookie: string; id: string; email: string }> {
    const email = `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    const response = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: 'password123', confirmPassword: 'password123' }),
    });
    expect(response.status).toBe(201);
    const setCookie = response.headers.get('set-cookie') || '';
    const cookie = setCookie.split(';')[0];
    const body = (await response.json()) as { user: { id: string; email: string } };
    return { cookie, id: body.user.id, email: body.user.email };
  }

  beforeAll(async () => {
    ensureTestDb();
    resetTestData();
    provider = new ScriptedProvider();
    setAIProvider(provider);

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    resetAIProvider();
  });

  /* ------------------------------- auth ------------------------------- */

  it('signs up, restores the session via /me, and rejects invalid credentials', async () => {
    const user = await signupUser('Alice');
    users.push(user);

    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: user.cookie } });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { user: { email: string } };
    expect(meBody.user.email).toBe(user.email);

    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'wrong-password' }),
    });
    expect(badLogin.status).toBe(401);

    // No cookie at all → 401 on protected routes.
    const noAuth = await fetch(`${baseUrl}/api/auth/me`);
    expect(noAuth.status).toBe(401);
  });

  it('logout invalidates the session cookie', async () => {
    const user = await signupUser('Bob');
    const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: user.cookie } });
    expect(logout.status).toBe(200);
    const after = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: user.cookie } });
    expect(after.status).toBe(401);
  });

  it('updates profile with name and email together', async () => {
    const user = await signupUser('Carol');
    const response = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ name: 'Caroline', email: `caroline-${Date.now()}@example.com` }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { name: string; email: string } };
    expect(body.user.name).toBe('Caroline');
    expect(body.user.email).toContain('caroline-');
  });

  it('lists and revokes sessions', async () => {
    const user = await signupUser('Dave');
    const list = await fetch(`${baseUrl}/api/auth/sessions`, { headers: { Cookie: user.cookie } });
    const { sessions } = (await list.json()) as { sessions: Array<{ id: string; isCurrent: boolean }> };
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.some((s) => s.isCurrent)).toBe(true);

    const nonCurrent = sessions.find((s) => !s.isCurrent);
    if (nonCurrent) {
      const revoke = await fetch(`${baseUrl}/api/auth/sessions/${nonCurrent.id}`, {
        method: 'DELETE',
        headers: { Cookie: user.cookie },
      });
      expect(revoke.status).toBe(200);
    }
  });

  /* -------------------------- conversations CRUD -------------------------- */

  it('creates, reads, patches (explicit pin), and deletes conversations', async () => {
    const user = await signupUser('Eve');
    users.push(user);

    const created = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({}),
    });
    expect(created.status).toBe(201);
    const { conversation } = (await created.json()) as { conversation: { id: string; title: string } };
    expect(conversation.title).toBe('New Chat');

    // Patch pinned: true on an unpinned conversation.
    const patch = await fetch(`${baseUrl}/api/conversations/${conversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ pinned: true, title: 'Pinned chat' }),
    });
    const patched = (await patch.json()) as { conversation: { pinned: boolean; title: string } };
    expect(patched.conversation.pinned).toBe(true);
    expect(patched.conversation.title).toBe('Pinned chat');

    // Idempotent: pinned: true again stays pinned (no toggle).
    const patch2 = await fetch(`${baseUrl}/api/conversations/${conversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ pinned: true }),
    });
    const patched2 = (await patch2.json()) as { conversation: { pinned: boolean } };
    expect(patched2.conversation.pinned).toBe(true);

    const del = await fetch(`${baseUrl}/api/conversations/${conversation.id}`, {
      method: 'DELETE',
      headers: { Cookie: user.cookie },
    });
    expect(del.status).toBe(200);

    const gone = await fetch(`${baseUrl}/api/conversations/${conversation.id}`, { headers: { Cookie: user.cookie } });
    expect(gone.status).toBe(404);
  });

  it('enforces ownership: another user cannot read, patch, or delete', async () => {
    const owner = await signupUser('Owner');
    const attacker = await signupUser('Attacker');

    const created = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: owner.cookie },
      body: JSON.stringify({ title: 'Private' }),
    });
    const { conversation } = (await created.json()) as { conversation: { id: string } };

    const read = await fetch(`${baseUrl}/api/conversations/${conversation.id}`, {
      headers: { Cookie: attacker.cookie },
    });
    expect(read.status).toBe(404);

    const patch = await fetch(`${baseUrl}/api/conversations/${conversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: attacker.cookie },
      body: JSON.stringify({ title: 'Hacked' }),
    });
    expect(patch.status).toBe(404);

    const del = await fetch(`${baseUrl}/api/conversations/${conversation.id}`, {
      method: 'DELETE',
      headers: { Cookie: attacker.cookie },
    });
    expect(del.status).toBe(404);

    // The abort endpoint must also reject cross-user aborts.
    const abort = await fetch(`${baseUrl}/api/ai/abort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: attacker.cookie },
      body: JSON.stringify({ conversationId: conversation.id, assistantMessageId: '00000000-0000-4000-8000-000000000000' }),
    });
    const abortBody = (await abort.json()) as { aborted: boolean };
    expect(abortBody.aborted).toBe(false);
  });

  it('searches conversations by title and message content', async () => {
    const user = await signupUser('Searcher');
    provider.queue(['unique searchable content'], { status: 'completed', content: '' });

    const chat = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ message: 'find the xylophone' }),
    });
    expect(chat.status).toBe(200);
    const events = await readSse(chat);
    expect(events[0]).toMatchObject({ type: 'start' });
    expect(events[events.length - 1]).toMatchObject({ type: 'done' });

    const byContent = await fetch(`${baseUrl}/api/conversations/search?q=xylophone`, {
      headers: { Cookie: user.cookie },
    });
    const contentResults = (await byContent.json()) as { conversations: Array<{ id: string }>; total: number };
    expect(contentResults.total).toBeGreaterThanOrEqual(1);

    const noEscape = await fetch(`${baseUrl}/api/conversations/search?q=%25`, { headers: { Cookie: user.cookie } });
    expect(noEscape.status).toBe(200);
  });

  /* ------------------------------- streaming ------------------------------- */

  it('streams one coherent assistant message with correct ids and persists content', async () => {
    const user = users[0];
    provider.queue(['The ', 'answer ', 'is ', 'straightforward.'], { status: 'completed', content: '' });

    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ message: 'What is the answer?' }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const events = await readSse(response);
    const start = events.find((e) => e.type === 'start') as { conversationId: string; userMessageId: string; assistantMessageId: string };
    expect(start).toBeDefined();

    const deltas = events.filter((e) => e.type === 'delta') as Array<{ content: string; assistantMessageId: string }>;
    // Every delta targets the SAME assistant message id.
    for (const delta of deltas) {
      expect(delta.assistantMessageId).toBe(start.assistantMessageId);
    }
    expect(deltas.map((d) => d.content).join('')).toBe('The answer is straightforward.');

    const done = events.find((e) => e.type === 'done') as { assistantMessageId: string };
    expect(done.assistantMessageId).toBe(start.assistantMessageId);

    // Persisted exactly once with full content.
    const loaded = await fetch(`${baseUrl}/api/conversations/${start.conversationId}`, {
      headers: { Cookie: user.cookie },
    });
    const history = (await loaded.json()) as { messages: Array<{ id: string; role: string; content: string; status: string }> };
    const assistantMessages = history.messages.filter((m) => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0].content).toBe('The answer is straightforward.');
    expect(assistantMessages[0].status).toBe('completed');

    // The follow-up request carries the previous exchange as history.
    provider.queue(['with context'], { status: 'completed', content: '' });
    await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ conversationId: start.conversationId, message: 'And now?' }),
    });
    const secondRequest = provider.requests[provider.requests.length - 1];
    expect(secondRequest.history?.length).toBeGreaterThanOrEqual(2);
    expect(secondRequest.message).toBe('And now?');
  });

  it('reports upstream failures as SSE error events and stores an error message', async () => {
    const user = users[0];
    provider.queue(['partial'], { status: 'error', content: '', error: 'Ollama error: model missing' });

    const response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ message: 'fail please' }),
    });
    const events = await readSse(response);
    const errorEvent = events.find((e) => e.type === 'error') as { message: string };
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('model missing');

    // The conversation must not contain a message stuck in 'streaming'.
    const list = await fetch(`${baseUrl}/api/conversations`, { headers: { Cookie: user.cookie } });
    const conversations = (await list.json()) as { data: Array<{ id: string }> };
    const latest = conversations.data[0];
    const loaded = await fetch(`${baseUrl}/api/conversations/${latest.id}`, { headers: { Cookie: user.cookie } });
    const history = (await loaded.json()) as { messages: Array<{ status: string; role: string }> };
    const streaming = history.messages.filter((m) => m.status === 'streaming');
    expect(streaming).toHaveLength(0);
    const errored = history.messages.filter((m) => m.status === 'error');
    expect(errored.length).toBeGreaterThanOrEqual(1);
  });

  it('regenerates through the SSE endpoint', async () => {
    const user = users[0];
    provider.queue(['initial'], { status: 'completed', content: '' });
    const chat = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ message: 'regen source' }),
    });
    const events = await readSse(chat);
    const start = events.find((e) => e.type === 'start') as { conversationId: string; assistantMessageId: string };

    provider.queue(['regenerated!'], { status: 'completed', content: '' });
    const regen = await fetch(`${baseUrl}/api/ai/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ conversationId: start.conversationId, assistantMessageId: start.assistantMessageId }),
    });
    const regenEvents = await readSse(regen);
    expect(regenEvents.some((e) => e.type === 'done')).toBe(true);

    const loaded = await fetch(`${baseUrl}/api/conversations/${start.conversationId}`, {
      headers: { Cookie: user.cookie },
    });
    const history = (await loaded.json()) as { messages: Array<{ id: string; content: string; role: string }> };
    const assistant = history.messages.find((m) => m.id === start.assistantMessageId);
    expect(assistant?.content).toBe('regenerated!');
    // Regeneration did not create a second assistant message.
    expect(history.messages.filter((m) => m.role === 'assistant')).toHaveLength(1);
  });

  it('rejects oversized and malformed chat bodies with 400', async () => {
    const user = users[0];
    const tooBig = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ message: 'x'.repeat(50001) }),
    });
    expect(tooBig.status).toBe(400);

    const badUuid = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ message: 'hi', conversationId: 'not-a-uuid' }),
    });
    expect(badUuid.status).toBe(400);
  });

  /* -------------------------------- settings -------------------------------- */

  it('persists settings updates', async () => {
    const user = await signupUser('Setter');
    const patch = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ temperature: 1.3, enterToSend: false, model: 'mock-model' }),
    });
    expect(patch.status).toBe(200);
    const body = (await patch.json()) as { preferences: { temperature: number; enterToSend: boolean; model: string } };
    expect(body.preferences.temperature).toBe(1.3);
    expect(body.preferences.enterToSend).toBe(false);
    expect(body.preferences.model).toBe('mock-model');

    const rejectBad = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ temperature: 9 }),
    });
    expect(rejectBad.status).toBe(400);
  });

  /* --------------------------------- models --------------------------------- */

  it('lists models and reports health through the API', async () => {
    const user = users[0];
    const models = await fetch(`${baseUrl}/api/ai/models`, { headers: { Cookie: user.cookie } });
    const modelsBody = (await models.json()) as { models: Array<{ name: string }> };
    expect(modelsBody.models[0].name).toBe('mock-model');

    const health = await fetch(`${baseUrl}/api/ai/health`, { headers: { Cookie: user.cookie } });
    const healthBody = (await health.json()) as { ai: ProviderHealth };
    expect(healthBody.ai.reachable).toBe(true);
  });

  it('returns JSON 404s for unknown API routes and validation errors carry field details', async () => {
    const user = users[0];
    const unknown = await fetch(`${baseUrl}/api/nonexistent`, { headers: { Cookie: user.cookie } });
    expect(unknown.status).toBe(404);
    const body = (await unknown.json()) as { code: string };
    expect(body.code).toBe('NOT_FOUND');

    const invalid = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'bad', password: 'x', confirmPassword: 'y' }),
    });
    expect(invalid.status).toBe(400);
    const invalidBody = (await invalid.json()) as { code: string; details: Array<{ field: string }> };
    expect(invalidBody.code).toBe('VALIDATION_ERROR');
    expect(invalidBody.details.length).toBeGreaterThan(0);
  });

  it('bulk deletion requires the exact confirmation literal', async () => {
    const user = await signupUser('Bulk');
    const wrong = await fetch(`${baseUrl}/api/conversations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ confirm: 'delete all' }),
    });
    expect(wrong.status).toBe(400);

    const right = await fetch(`${baseUrl}/api/conversations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: user.cookie },
      body: JSON.stringify({ confirm: 'DELETE ALL' }),
    });
    expect(right.status).toBe(200);
  });
});
