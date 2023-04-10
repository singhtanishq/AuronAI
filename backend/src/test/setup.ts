import { initializeDatabase } from '../database';
import { getDatabase } from '../database';

/**
 * Test environment setup: point the database at a disposable temp file and
 * neutralize rate limits before any application module is imported.
 */
import os from 'os';
import path from 'path';
import fs from 'fs';

const testDbPath = path.join(os.tmpdir(), `auron-test-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';

let initialized = false;

export function ensureTestDb(): void {
  if (!initialized) {
    initializeDatabase();
    initialized = true;
  }
}

/** Remove all rows between test cases while keeping the schema. */
export function resetTestData(): void {
  ensureTestDb();
  const db = getDatabase();
  db.exec(`
    DELETE FROM messages;
    DELETE FROM conversations;
    DELETE FROM user_preferences;
    DELETE FROM sessions;
    DELETE FROM users;
  `);
}

if (typeof process.on === 'function') {
  process.on('exit', () => {
    try {
      fs.rmSync(testDbPath, { force: true });
      fs.rmSync(`${testDbPath}-wal`, { force: true });
      fs.rmSync(`${testDbPath}-shm`, { force: true });
    } catch {
      // best effort
    }
  });
}
