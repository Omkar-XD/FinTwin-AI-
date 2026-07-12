import assert from 'node:assert/strict';
import test from 'node:test';

test('uses the configured frontend URL for production CORS and omits localhost fallback', async () => {
  process.env['FRONTEND_URL'] = 'https://fintwin-ai.vercel.app';
  process.env['NODE_ENV'] = 'production';

  const { getAllowedOrigins } = await import('./cors.js');

  assert.deepStrictEqual(getAllowedOrigins(), ['https://fintwin-ai.vercel.app']);
});
