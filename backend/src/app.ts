import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import aiRoutes from './routes/ai';
import settingsRoutes from './routes/settings';
import healthRoutes from './routes/health';

export function createApp(): express.Application {
  const app = express();

  // Trust the first proxy hop for correct client IPs behind a reverse proxy.
  app.set('trust proxy', 1);

  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // General API rate limit; per-user generation limits live on /api/ai.
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Health check (no auth required)
  app.use('/api/health', healthRoutes);

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/settings', settingsRoutes);

  // Unknown API routes return JSON 404s, never the SPA shell.
  app.use('/api', notFoundHandler);

  // Production: serve the compiled frontend with an SPA fallback. The data
  // directory and other private files are never under the static root.
  if (config.isProduction || process.env.SERVE_STATIC === 'true') {
    const staticRoot = config.staticRoot;
    const indexPath = path.join(staticRoot, 'index.html');
    const hasBuild = fs.existsSync(indexPath);

    if (hasBuild) {
      app.use(express.static(staticRoot, { index: false, maxAge: '1h' }));
      app.get('*', (_req, res) => {
        res.sendFile(indexPath);
      });
      logger.info(`Serving frontend from ${staticRoot}`);
    } else {
      logger.warn(
        `STATIC_ROOT (${staticRoot}) has no index.html; the frontend must be served separately. Build it with \`npm run build:frontend\`.`
      );
      app.get('*', notFoundHandler);
    }
  } else {
    // Development: the frontend runs on its own Vite dev server.
    app.get('*', notFoundHandler);
  }

  app.use(errorHandler);

  return app;
}
