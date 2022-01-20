import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

export interface Migration {
  id: number;
  name: string;
  up: (db: Database.Database) => void;
}

/**
 * Migration 1 — baseline schema.
 *
 * This is the schema the application has always created with
 * `CREATE TABLE IF NOT EXISTS`. It is kept byte-compatible so existing user
 * databases are recognized correctly; timestamp defaults use the ISO 8601
 * format the application writes explicitly on every insert.
 */
const baseline: Migration = {
  id: 1,
  name: 'baseline-schema',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_color TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'New Chat',
        pinned INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON conversations(user_id, pinned DESC, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'streaming', 'completed', 'error', 'aborted')),
        token_count INTEGER,
        generation_time_ms INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(conversation_id, created_at);

      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        theme TEXT NOT NULL DEFAULT 'system',
        sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
        enter_to_send INTEGER NOT NULL DEFAULT 1,
        show_timestamps INTEGER NOT NULL DEFAULT 1,
        auto_scroll INTEGER NOT NULL DEFAULT 1,
        model TEXT NOT NULL DEFAULT 'qwen2.5:3b',
        temperature REAL NOT NULL DEFAULT 0.7,
        system_prompt TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
  },
};

/**
 * Migration 2 — integrity and timestamp normalization.
 *
 * - Normalizes every timestamp column (including rows written by older
 *   versions using SQLite's `datetime('now')` format) to ISO 8601 UTC so
 *   string ordering and JS date parsing are correct and consistent.
 * - Deduplicates session token hashes and enforces uniqueness with a unique
 *   index; session lookup runs on every authenticated request.
 * - Replaces the update-timestamp triggers with ISO-format versions.
 * - Adds an index for the archive filter used by the conversation list.
 */
const integrity: Migration = {
  id: 2,
  name: 'timestamp-normalization-and-session-index',
  up: (db) => {
    const timestampColumns: Array<{ table: string; columns: string[] }> = [
      { table: 'users', columns: ['created_at', 'updated_at'] },
      { table: 'conversations', columns: ['created_at', 'updated_at'] },
      { table: 'messages', columns: ['created_at', 'updated_at'] },
      { table: 'user_preferences', columns: ['created_at', 'updated_at'] },
      { table: 'sessions', columns: ['created_at', 'expires_at'] },
    ];

    for (const { table, columns } of timestampColumns) {
      for (const column of columns) {
        db.exec(
          `UPDATE ${table} SET ${column} = strftime('%Y-%m-%dT%H:%M:%fZ', ${column}) WHERE ${column} IS NOT NULL`
        );
      }
    }

    db.exec(`
      DELETE FROM sessions WHERE rowid NOT IN (SELECT MIN(rowid) FROM sessions GROUP BY token_hash);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_conversations_user_archived ON conversations(user_id, archived);

      DROP TRIGGER IF EXISTS update_users_timestamp;
      DROP TRIGGER IF EXISTS update_conversations_timestamp;
      DROP TRIGGER IF EXISTS update_messages_timestamp;
      DROP TRIGGER IF EXISTS update_user_preferences_timestamp;

      CREATE TRIGGER update_users_timestamp
      AFTER UPDATE ON users
      BEGIN
        UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
      END;

      CREATE TRIGGER update_conversations_timestamp
      AFTER UPDATE ON conversations
      BEGIN
        UPDATE conversations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
      END;

      CREATE TRIGGER update_messages_timestamp
      AFTER UPDATE ON messages
      BEGIN
        UPDATE messages SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
      END;

      CREATE TRIGGER update_user_preferences_timestamp
      AFTER UPDATE ON user_preferences
      BEGIN
        UPDATE user_preferences SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = NEW.user_id;
      END;
    `);
  },
};

export const migrations: Migration[] = [baseline, integrity];

export function runMigrations(db: Database.Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: number }>;
  const applied = new Set(appliedRows.map((row) => row.id));

  let appliedCount = 0;
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        migration.id,
        migration.name,
        new Date().toISOString()
      );
    });

    try {
      apply();
      appliedCount += 1;
      logger.info(`Migration ${migration.id} applied: ${migration.name}`);
    } catch (error) {
      logger.error(`Migration ${migration.id} (${migration.name}) failed`, error as Record<string, unknown>);
      throw new Error(`Database migration ${migration.id} (${migration.name}) failed: ${(error as Error).message}`);
    }
  }

  return appliedCount;
}

export function getSchemaVersion(db: Database.Database): number | null {
  const row = db.prepare('SELECT MAX(id) as version FROM schema_migrations').get() as { version: number | null } | undefined;
  return row?.version ?? null;
}
