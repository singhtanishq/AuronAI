import { createApp } from './app';
import { config } from './config';
import { initializeDatabase, closeDatabase } from './database';
import { logger } from './utils/logger';
import { authService } from './services/authService';
import { abortAllGenerations } from './services/chatService';

async function startServer(): Promise<void> {
  try {
    initializeDatabase();

    const sessionCleanupTimer = setInterval(() => {
      authService.cleanupExpiredSessions().catch((err) => logger.error('Session cleanup failed', err as Record<string, unknown>));
    }, 60 * 60 * 1000); // Every hour
    sessionCleanupTimer.unref();

    const app = createApp();
    const server = app.listen(config.port, () => {
      logger.info(`Auron AI Backend started on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Frontend URL: ${config.frontendUrl}`);
      logger.info(`Ollama URL: ${config.ollama.baseUrl}`);
      logger.info(`Default Model: ${config.ollama.defaultModel}`);
    });

    const shutdown = (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      abortAllGenerations();

      server.close(() => {
        sessionCleanupTimer.unref();
        closeDatabase();
        logger.info('HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', error as Record<string, unknown>);
    process.exit(1);
  }
}

void startServer();
