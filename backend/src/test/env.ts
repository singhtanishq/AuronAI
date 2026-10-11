/**
 * Test environment bootstrap. This file must contain NO application imports —
 * Vitest evaluates setupFiles in order, and every application module reads
 * configuration at import time. Setting the env vars here guarantees that
 * application modules imported later resolve to the disposable test database.
 */
import os from 'os';
import path from 'path';

const testDbPath = path.join(os.tmpdir(), `auron-test-${process.pid}-${Date.now()}.db`);
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = testDbPath;
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';

process.on('exit', () => {
  try {
    const fs = require('fs') as typeof import('fs');
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(testDbPath + suffix, { force: true });
    }
  } catch {
    // best effort
  }
});
