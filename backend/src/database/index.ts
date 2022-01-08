import Database from 'better-sqlite3';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import { runMigrations } from './migrations';

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
  db.pragma('busy_timeout = 5000');
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

/** Run `fn` inside a single SQLite transaction; rolls back on throw. */
export function withTransaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}

export function initializeDatabase(): void {
  const database = getDatabase();
  const applied = runMigrations(database);
  if (applied > 0) {
    logger.info(`Applied ${applied} database migration(s)`);
  }
}
