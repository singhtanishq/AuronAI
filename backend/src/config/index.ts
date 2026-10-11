import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

function intEnv(name: string, fallback: number, { min, max }: { min?: number; max?: number } = {}): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) return fallback;
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

/**
 * Directory containing the built frontend, for production static serving.
 * Resolved from whichever layout is in use (tsx runs from src/, the compiled
 * server from dist/); override with STATIC_ROOT when deploying differently.
 */
function resolveDefaultStaticRoot(): string {
  const candidates = [
    path.resolve(__dirname, '../../frontend/dist'), // running from src/
    path.resolve(__dirname, '../../../frontend/dist'), // running from dist/
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return candidates[0];
}

export const config = {
  nodeEnv,
  isProduction,
  port: intEnv('PORT', 3001, { min: 1, max: 65535 }),

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  database: {
    path: process.env.DATABASE_PATH || './data/auron.db',
  },

  staticRoot: process.env.STATIC_ROOT ? path.resolve(process.env.STATIC_ROOT) : resolveDefaultStaticRoot(),

  ollama: {
    baseUrl: (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, ''),
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:3b',
    /** Hard cap on a single generation, including connection time. */
    timeoutMs: intEnv('OLLAMA_TIMEOUT', 300000, { min: 1000 }),
    /** Maximum time to wait between stream chunks before giving up. */
    idleTimeoutMs: intEnv('OLLAMA_IDLE_TIMEOUT', 60000, { min: 1000 }),
  },

  session: {
    cookieName: process.env.SESSION_COOKIE_NAME || 'auron_session',
    cookieMaxAgeMs: 1000 * 60 * 60 * 24 * 30, // 30 days, matches session rows
  },

  auth: {
    passwordMinLength: 8,
    passwordMaxLength: 128,
    tokenExpiryDays: 30,
  },

  chat: {
    /** Maximum characters of history sent to the model (system prompt excluded). */
    maxContextChars: intEnv('CHAT_MAX_CONTEXT_CHARS', 24000, { min: 2000 }),
    /** Individual history messages above this size are trimmed. */
    maxHistoryMessageChars: intEnv('CHAT_MAX_MESSAGE_CHARS', 8000, { min: 200 }),
    /** Maximum concurrent generations per user. */
    maxConcurrentGenerationsPerUser: intEnv('CHAT_MAX_CONCURRENT', 2, { min: 1 }),
    /** Interval at which partial stream output is flushed to the database. */
    contentFlushIntervalMs: 750,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    maxRequests: intEnv('RATE_LIMIT_MAX', 300, { min: 10 }),
    // Auth attempts get a much tighter budget; note /api/auth/me is NOT
    // included (it runs on every app load and must not lock users out).
    authWindowMs: 15 * 60 * 1000,
    authMaxAttempts: intEnv('AUTH_RATE_LIMIT_MAX', 20, { min: 5 }),
    generationWindowMs: 60 * 1000,
    generationMaxRequests: 30,
  },
} as const;

export type Config = typeof config;
