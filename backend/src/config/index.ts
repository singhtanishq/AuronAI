import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  database: {
    path: process.env.DATABASE_PATH || './data/auron.db',
  },

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:3b',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10),
  },

  session: {
    secret: process.env.SESSION_SECRET || 'auron-ai-dev-secret-change-in-production',
    cookieName: 'auron_session',
    cookieMaxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  },

  auth: {
    passwordMinLength: 8,
    tokenExpiry: '30d',
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
} as const;

export type Config = typeof config;