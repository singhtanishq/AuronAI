/**
 * Test environment bootstrap. This file must contain NO application imports —
 * Vitest evaluates setupFiles in order, and every application module reads
 * configuration at import time. Setting the env vars here guarantees that
 * application modules imported later resolve to the disposable test database.
 *
 * The path is unique per worker (VITEST_POOL_ID) so parallel test files never
 * share a database file.
 */
import os from 'os';
import path from 'path';
import fs from 'fs';

const poolId = process.env.VITEST_POOL_ID ?? process.pid.toString();
const testDbPath = path.join(os.tmpdir(), `auron-test-${poolId}.db`);
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = testDbPath;
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';

process.on('exit', () => {
  try {
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(testDbPath + suffix, { force: true });
    }
  } catch {
    // best effort
  }
});
