import { Hono } from 'hono';
import type { HealthStatus } from '../types/index.js';

export const healthRoutes = new Hono();

healthRoutes.get('/', (c) => {
  const body: HealthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
  return c.json(body);
});
