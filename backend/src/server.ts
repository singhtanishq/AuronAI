import { createApp } from './app';
import { config } from './config';
import { initializeDatabase } from './database';
import { logger } from './utils/logger';
import { authService } from './services/authService';

const app = createApp();

async function startServer(): Promise<void> {
  try {
    // Initialize database
    initializeDatabase();

    // Schedule expired session cleanup
    setInterval(() => {
      authService.cleanupExpiredSessions().catch(err => logger.error('Session cleanup failed', err));
    }, 60 * 60 * 1000); // Every hour

    const server = app.listen(config.port, () => {
      logger.info(`Auron AI Backend started on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Frontend URL: ${config.frontendUrl}`);
      logger.info(`Ollama URL: ${config.ollama.baseUrl}`);
      logger.info(`Default Model: ${config.ollama.defaultModel}`);
    });

    // Graceful shutdown
    const shutdown = (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();