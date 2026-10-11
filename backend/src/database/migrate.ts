import { getDatabase, initializeDatabase, closeDatabase } from './index';
import { getSchemaVersion } from './migrations';
import { logger } from '../utils/logger';

/**
 * Standalone migration command (`npm run db:migrate`). The server also runs
 * migrations automatically on startup, so this is mainly an operator tool for
 * verifying or pre-applying upgrades.
 */
try {
  initializeDatabase();
  const db = getDatabase();
  const version = getSchemaVersion(db);
  logger.info(`Database migrations up to date. Schema version: ${version ?? 'unknown'}`);
  closeDatabase();
  process.exit(0);
} catch (error) {
  logger.error('Database migration failed', error as Record<string, unknown>);
  process.exit(1);
}
