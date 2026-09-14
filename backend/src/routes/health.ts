import { Router } from 'express';
import { getDatabase } from '../database';
import { getAIProvider } from '../providers';
import { config } from '../config';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const db = getDatabase();
  let dbHealthy = false;

  try {
    db.prepare('SELECT 1').get();
    dbHealthy = true;
  } catch (error) {
    logger.error('Database health check failed', error as Record<string, unknown>);
  }

  const provider = getAIProvider();
  const aiHealth = await provider.healthCheck();

  const healthy = dbHealthy && aiHealth.reachable;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.nodeEnv,
    services: {
      database: dbHealthy,
      ollama: aiHealth.reachable,
    },
    ollama: {
      reachable: aiHealth.reachable,
      models: aiHealth.models,
      defaultModel: aiHealth.defaultModel,
      error: aiHealth.error,
    },
  });
}));

router.get('/ai', asyncHandler(async (req, res) => {
  const provider = getAIProvider();
  const health = await provider.healthCheck();
  res.json(health);
}));

router.get('/models', asyncHandler(async (req, res) => {
  const provider = getAIProvider();
  const models = await provider.listModels();
  res.json({ models });
}));

export default router;