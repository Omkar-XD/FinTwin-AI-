import { config } from 'dotenv';
import { resolve } from 'node:path';
import {
  DEFAULT_GEMINI_EMBEDDING_DIMENSIONS,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
} from './models.js';

config({ path: resolve(process.cwd(), '.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function normalizeRedisUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('redis://') || trimmed.startsWith('rediss://')) {
    return trimmed;
  }

  const match = trimmed.match(/(rediss?):\/\/[^\s]+/);
  if (match) {
    const url = match[0];
    if (trimmed.includes('--tls') && url.startsWith('redis://')) {
      return url.replace('redis://', 'rediss://');
    }
    return url;
  }

  return trimmed;
}

export const env = {
  port: Number.parseInt(optionalEnv('PORT', '3001'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isDev: optionalEnv('NODE_ENV', 'development') !== 'production',
  frontendUrl: optionalEnv('FRONTEND_URL'),
  redisUrl: normalizeRedisUrl(optionalEnv('REDIS_URL', 'redis://localhost:6379')),
  supabaseUrl: optionalEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: optionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
  qdrantUrl: optionalEnv('QDRANT_URL', 'http://localhost:6333'),
  qdrantApiKey: optionalEnv('QDRANT_API_KEY'),
  groqApiKey: optionalEnv('GROQ_API_KEY'),
  googleGenerativeAiApiKey: optionalEnv('GOOGLE_GENERATIVE_AI_API_KEY'),
  geminiEmbeddingModel: optionalEnv('GEMINI_EMBEDDING_MODEL', DEFAULT_GEMINI_EMBEDDING_MODEL),
  geminiEmbeddingDimensions: Number.parseInt(
    optionalEnv('GEMINI_EMBEDDING_DIMENSIONS', String(DEFAULT_GEMINI_EMBEDDING_DIMENSIONS)),
    10,
  ),
  enkryptApiKey: optionalEnv('ENKRYPT_API_KEY'),
  enkryptBaseUrl: optionalEnv('ENKRYPT_BASE_URL', 'https://api.enkryptai.com'),
} as const;

export { requireEnv, optionalEnv };
