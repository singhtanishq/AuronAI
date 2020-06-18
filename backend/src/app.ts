import express from 'express';
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

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // CORS configuration
  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Stricter rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: { code: 'RATE_LIMITED', message: 'Too many authentication attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/', authLimiter);

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

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}