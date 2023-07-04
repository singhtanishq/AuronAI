import os from 'os';
import path from 'path';
import { initializeDatabase, getDatabase } from '../database';

/**
 * Hard guard: the test database must live in the OS temp directory. If the
 * environment wiring ever regresses, fail loudly instead of touching a real
 * user database.
 */
const dbPath = process.env.DATABASE_PATH || '';
const tempDir = os.tmpdir();
if (!path.isAbsolute(dbPath) || !dbPath.startsWith(tempDir + path.sep)) {
  throw new Error(
    `Refusing to run tests: DATABASE_PATH ("${dbPath}") is not inside the temp directory ("${tempDir}"). ` +
      'Fix src/test/env.ts ordering before proceeding.'
  );
}

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
