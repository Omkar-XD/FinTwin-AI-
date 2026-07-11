import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { corsMiddleware } from './lib/cors.js';
import { env } from './lib/env.js';
import { routes } from './routes/index.js';

const app = new Hono();

app.use('*', corsMiddleware);
app.route('/', routes);

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

/* DEBUG */
console.log('===============================');
console.log('SUPABASE URL:', env.supabaseUrl);
console.log('PORT:', env.port);
console.log('===============================');

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`Server running at http://localhost:${info.port}`);
  },
);

export default app;