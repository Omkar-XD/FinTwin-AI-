import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { corsMiddleware, getAllowedOrigins } from './lib/cors.js';
import { env } from './lib/env.js';
import { routes } from './routes/index.js';

const app = new Hono();

// Global Middleware
app.use('*', corsMiddleware);

// Routes
app.route('/', routes);

// Global Error Handler
app.onError((error, c) => {
  console.error('Unhandled route error:', error);

  return c.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    500,
  );
});

/* ===========================
   DEBUG LOGS
=========================== */

console.log('========================================');
console.log('🚀 FinTwin AI Backend Starting...');
console.log('NODE_ENV:', env.nodeEnv);
console.log('FRONTEND_URL:', env.frontendUrl);
console.log('ALLOWED_ORIGINS:', getAllowedOrigins());
console.log('PORT:', env.port);
console.log('SUPABASE_URL:', env.supabaseUrl);
console.log('REDIS_URL:', env.redisUrl);
console.log('========================================');

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`✅ Server running at http://localhost:${info.port}`);
  },
);

export default app;