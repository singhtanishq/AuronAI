import { initializeDatabase } from './index';
import { logger } from '../utils/logger';

try {
  initializeDatabase();
  logger.info('Database initialization completed successfully', {});
  process.exit(0);
} catch (error) {
  logger.error('Database initialization failed', error);
  process.exit(1);
}