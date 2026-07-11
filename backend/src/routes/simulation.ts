import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../lib/auth.js';
import { runScenarioSimulation } from '../lib/financial-ai.js';
import { errorResponse, internalErrorMessage } from '../lib/http-error.js';
import { scenarioRequestSchema } from '../lib/scenarios.js';

export const simulationRoutes = new Hono<AppBindings>();

const simulationRequestSchema = z.object({
  userId: z.string().min(1),
  ...scenarioRequestSchema.shape,
});

simulationRoutes.post('/run', async (c) => {
  try {
    const parsed = simulationRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse(c, 400, 'Invalid request body', 'BAD_REQUEST');
    }

    const verifiedUserId = c.get('userId');
    const { userId, scenarioType, params } = parsed.data;
    if (userId !== verifiedUserId) {
      return errorResponse(c, 403, 'Forbidden', 'FORBIDDEN');
    }

    const result = await runScenarioSimulation(userId, scenarioType, params);
    return c.json({ projectedOutcome: result.projectedOutcome });
  } catch (error) {
    console.error('Simulation route failed:', error);
    return errorResponse(c, 500, internalErrorMessage(error, 'Failed to run simulation'), 'INTERNAL_ERROR');
  }
});
