import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { callLLM, parseJsonFromLLM } from '../lib/llm.js';
import { GROQ_CHAT_MODEL } from '../lib/models.js';
export { scenarioTypes, scenarioTypeSchema, type ScenarioType } from '../lib/scenarios.js';

export const simulationProjectionSchema = z.object({
  projectedNetWorth: z.object({
    months12: z.number(),
    months24: z.number(),
    months36: z.number(),
  }),
  projectedCashFlow: z.object({
    months12: z.number(),
    months24: z.number(),
    months36: z.number(),
  }),
  narrative: z.string(),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export type SimulationProjection = z.infer<typeof simulationProjectionSchema>;

export const SCENARIO_SIMULATION_AGENT_INSTRUCTIONS = `You are a financial scenario simulation analyst. Use only the user's verified financial profile, latest risk score, scenario parameters, and retrieved memory context.

Project the impact of the requested scenario over 12, 24, and 36 months. Return structured JSON with projected net worth, projected monthly cash flow, a concise narrative, assumptions, and risks.

Rules:
- Ground all figures in the supplied profile, risk score, and scenario params.
- If a required value is missing, state a conservative assumption in the assumptions array.
- Do not provide legal, tax, or investment guarantees.
- Keep the narrative practical and explain the key drivers of the projection.`;

export const scenarioSimulationAgent = new Agent({
  id: 'scenarioSimulationAgent',
  name: 'Scenario Simulation Agent',
  instructions: SCENARIO_SIMULATION_AGENT_INSTRUCTIONS,
  model: GROQ_CHAT_MODEL,
});

export async function simulateScenarioWithLLM(
  context: Record<string, unknown>,
): Promise<SimulationProjection> {
  try {
    const prompt = [
      'Project the financial impact of the requested scenario over 12, 24, and 36 months.',
      'Return only JSON matching this shape: projectedNetWorth, projectedCashFlow, narrative, assumptions, risks.',
      'If required values are missing, use conservative assumptions and state them.',
      'Context:',
      JSON.stringify(context),
    ].join('\n\n');

    const raw = await callLLM(prompt, SCENARIO_SIMULATION_AGENT_INSTRUCTIONS);
    const parsed = parseJsonFromLLM<unknown>(raw, {
      projectedNetWorth: { months12: 0, months24: 0, months36: 0 },
      projectedCashFlow: { months12: 0, months24: 0, months36: 0 },
      narrative: 'Unable to produce a projection from the available data.',
      assumptions: ['Projection unavailable; manual review recommended.'],
      risks: ['Review this scenario with a qualified financial advisor before acting.'],
    });

    const result = simulationProjectionSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Scenario simulation failed schema validation: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.error('scenarioSimulationAgent step failed:', error);
    throw error;
  }
}
