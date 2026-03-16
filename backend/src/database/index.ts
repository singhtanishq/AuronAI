import Database from 'better-sqlite3';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dbPath = config.database.path;
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created database directory: ${dir}`);
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -20000');
  db.pragma('temp_store = MEMORY');

  logger.info(`Database connected: ${dbPath}`);
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

export function initializeDatabase(): void {
  const database = getDatabase();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New Chat',
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TRIGGER IF NOT EXISTS update_users_timestamp
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp
    AFTER UPDATE ON conversations
    BEGIN
      UPDATE conversations SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_messages_timestamp
    AFTER UPDATE ON messages
    BEGIN
      UPDATE messages SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_user_preferences_timestamp
    AFTER UPDATE ON user_preferences
    BEGIN
      UPDATE user_preferences SET updated_at = datetime('now') WHERE user_id = NEW.user_id;
    END;
  `);

  logger.info('Database schema initialized');
}