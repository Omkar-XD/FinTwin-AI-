import { cors } from 'hono/cors';
import { env } from './env.js';

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  if (env.nodeEnv !== 'production') {
    origins.add('http://localhost:3000');
  }

  if (env.frontendUrl) {
    origins.add(env.frontendUrl);
  }

  return Array.from(origins);
}

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowedOrigins = getAllowedOrigins();

    if (!origin) {
      return allowedOrigins[0] ?? '';
    }

    if (allowedOrigins.includes(origin)) {
      return origin;
    }

    return '';
  },

  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  maxAge: 86400,
});