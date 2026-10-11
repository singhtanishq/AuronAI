import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { runMigrations, getSchemaVersion, migrations } from '../database/migrations';

function createTempDb(): { db: Database.Database; file: string } {
  const file = path.join(os.tmpdir(), `auron-mig-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  return { db: new Database(file), file };
}

function cleanup(file: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(file + suffix, { force: true });
    } catch {
      // best effort
    }
  }
}

describe('database migrations', () => {
  it('creates the full schema on a fresh database', () => {
    const { db, file } = createTempDb();
    try {
      const applied = runMigrations(db);
      expect(applied).toBe(migrations.length);
      expect(getSchemaVersion(db)).toBe(migrations.length);

      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
        .all()
        .map((r: any) => r.name);
      for (const expected of ['users', 'conversations', 'messages', 'user_preferences', 'sessions', 'schema_migrations']) {
        expect(tables).toContain(expected);
      }

      const indexes = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='index'`)
        .all()
        .map((r: any) => r.name);
      expect(indexes).toContain('idx_sessions_token_hash');
      expect(indexes).toContain('idx_messages_conversation_id');

      const triggers = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='trigger'`)
        .all()
        .map((r: any) => r.name);
      expect(triggers).toContain('update_messages_timestamp');
    } finally {
      db.close();
      cleanup(file);
    }
  });

  it('is idempotent — rerunning applies nothing', () => {
    const { db, file } = createTempDb();
    try {
      runMigrations(db);
      const appliedAgain = runMigrations(db);
      expect(appliedAgain).toBe(0);
      expect(getSchemaVersion(db)).toBe(migrations.length);
    } finally {
      db.close();
      cleanup(file);
    }
  });

  it('normalizes legacy datetime timestamps to ISO 8601 UTC', () => {
    const { db, file } = createTempDb();

    try {
      // Build a "legacy" database: the original schema with SQLite's
      // datetime('now') defaults and rows written in the old format.
      db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          avatar_color TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT 'New Chat',
          pinned INTEGER NOT NULL DEFAULT 0,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          model TEXT,
          status TEXT NOT NULL DEFAULT 'completed',
          token_count INTEGER,
          generation_time_ms INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
        CREATE TABLE user_preferences (
          user_id TEXT PRIMARY KEY,
          theme TEXT NOT NULL DEFAULT 'system',
          sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
          enter_to_send INTEGER NOT NULL DEFAULT 1,
          show_timestamps INTEGER NOT NULL DEFAULT 1,
          auto_scroll INTEGER NOT NULL DEFAULT 1,
          model TEXT NOT NULL DEFAULT 'qwen2.5:3b',
          temperature REAL NOT NULL DEFAULT 0.7,
          system_prompt TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      db.prepare(
        `INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
         VALUES ('u1', 'Legacy', 'legacy@example.com', 'hash', '2026-10-11 10:00:00', '2026-10-11 10:00:00')`
      ).run();
      db.prepare(
        `INSERT INTO conversations (id, user_id, title, created_at, updated_at)
         VALUES ('c1', 'u1', 'Legacy chat', '2026-10-11 10:00:01', '2026-10-11 10:00:01')`
      ).run();
      db.prepare(
        `INSERT INTO messages (id, conversation_id, role, content, created_at, updated_at)
         VALUES ('m1', 'c1', 'user', 'hello', '2026-10-11 10:00:02', '2026-10-11 10:00:02')`
      ).run();
      // ISO-format expires_at (as older app code wrote) plus a duplicate hash
      // to exercise deduplication.
      db.prepare(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
         VALUES ('s1', 'u1', 'duplicatehash', '2026-11-10T10:00:00.000Z', '2026-10-11 10:00:00')`
      ).run();
      db.prepare(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
         VALUES ('s2', 'u1', 'duplicatehash', '2026-11-10T10:00:00.000Z', '2026-10-11 10:00:01')`
      ).run();

      runMigrations(db);

      const userRow = db.prepare(`SELECT created_at FROM users WHERE id = 'u1'`).get() as any;
      expect(userRow.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(userRow.created_at.startsWith('2026-10-11T')).toBe(true);

      const messageRow = db.prepare(`SELECT created_at FROM messages WHERE id = 'm1'`).get() as any;
      expect(messageRow.created_at).toContain('T');

      // Duplicate token hashes were reduced to one.
      const sessionCount = (db.prepare(`SELECT COUNT(*) as c FROM sessions`).get() as any).c;
      expect(sessionCount).toBe(1);

      // Unique index exists and is enforced.
      expect(() =>
        db
          .prepare(`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ('s3', 'u1', 'duplicatehash', '2026-12-01')`)
          .run()
      ).toThrow();
    } finally {
      db.close();
      cleanup(file);
    }
  });

  it('keeps ordering deterministic when timestamps collide (rowid tiebreaker)', () => {
    const { db, file } = createTempDb();
    try {
      runMigrations(db);
      db.prepare(
        `INSERT INTO users (id, name, email, password_hash) VALUES ('u1', 'T', 't@example.com', 'h')`
      ).run();
      db.prepare(`INSERT INTO conversations (id, user_id) VALUES ('c1', 'u1')`).run();

      const insert = db.prepare(
        `INSERT INTO messages (id, conversation_id, role, content, created_at, updated_at)
         VALUES (?, 'c1', 'user', ?, '2026-10-11T10:00:00.000Z', '2026-10-11T10:00:00.000Z')`
      );
      insert.run('m-a', 'first');
      insert.run('m-b', 'second');
      insert.run('m-c', 'third');

      const rows = db
        .prepare(`SELECT id FROM messages WHERE conversation_id = 'c1' ORDER BY created_at ASC, rowid ASC`)
        .all() as Array<{ id: string }>;
      expect(rows.map((r) => r.id)).toEqual(['m-a', 'm-b', 'm-c']);
    } finally {
      db.close();
      cleanup(file);
    }
  });
});
