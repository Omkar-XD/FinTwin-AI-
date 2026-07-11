import { cors } from 'hono/cors';
import { env } from './env.js';

function getAllowedOrigins(): string[] {
  const origins = ['http://localhost:3000'];
  if (env.frontendUrl) {
    origins.push(env.frontendUrl);
  }
  return origins;
}

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowed = getAllowedOrigins();
    if (!origin || allowed.includes(origin)) {
      return origin ?? allowed[0]!;
    }
    return allowed[0]!;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
