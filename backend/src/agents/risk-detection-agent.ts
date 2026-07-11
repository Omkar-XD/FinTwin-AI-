import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { callLLM, parseJsonFromLLM } from '../lib/llm.js';
import { GROQ_CHAT_MODEL } from '../lib/models.js';

export const riskAssessmentSchema = z.object({
  debt_to_income: z.number().min(0).nullable().optional(),
  credit_utilization: z.number().min(0).max(100).nullable().optional(),
  cash_flow_status: z.enum(['positive', 'negative', 'neutral', 'unknown']),
  savings_adequacy: z.enum(['adequate', 'inadequate', 'critical', 'unknown']),
  risk_score: z.number().min(0).max(100),
  risk_factors: z.array(z.string()).default([]),
});

export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;

export const RISK_DETECTION_AGENT_INSTRUCTIONS = `You are a financial risk analyst. Given a user's current financial profile, newly extracted document data, and historical profile snapshots, compute risk metrics:

- debt_to_income: debt-to-income ratio as a percentage (monthly debt payments / monthly income * 100). Use null if insufficient data.
- credit_utilization: estimated credit utilization percentage (0-100). Use null if insufficient data.
- cash_flow_status: "positive" if income exceeds expenses, "negative" if expenses exceed income, "neutral" if roughly balanced, "unknown" if data is missing.
- savings_adequacy: "adequate" if savings cover 3+ months expenses, "inadequate" if 1-3 months, "critical" if under 1 month, "unknown" if data is missing.
- risk_score: overall financial risk from 0 (low risk) to 100 (high risk).
- risk_factors: list of specific risk factors identified (e.g. high debt ratio, negative cash flow).

Base your analysis on verified profile data and historical context. Be conservative when data is incomplete.`;

export const riskDetectionAgent = new Agent({
  id: 'riskDetectionAgent',
  name: 'Risk Detection Agent',
  instructions: RISK_DETECTION_AGENT_INSTRUCTIONS,
  model: GROQ_CHAT_MODEL,
});

export async function assessRiskWithLLM(
  analysisContext: Record<string, unknown>,
): Promise<RiskAssessment> {
  try {
    const prompt = [
      'Analyze the financial risk for this user using the provided context.',
      'Return only JSON matching this schema: debt_to_income, credit_utilization, cash_flow_status, savings_adequacy, risk_score, risk_factors.',
      'Context:',
      JSON.stringify(analysisContext),
    ].join('\n\n');

    const raw = await callLLM(prompt, RISK_DETECTION_AGENT_INSTRUCTIONS);
    const parsed = parseJsonFromLLM<unknown>(raw, {
      cash_flow_status: 'unknown',
      savings_adequacy: 'unknown',
      risk_score: 50,
      risk_factors: ['Insufficient data for full risk assessment'],
    });

    const result = riskAssessmentSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Risk assessment failed schema validation: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.error('riskDetectionAgent step failed; using conservative fallback:', error);
    return {
      debt_to_income: null,
      credit_utilization: null,
      cash_flow_status: 'unknown',
      savings_adequacy: 'unknown',
      risk_score: 50,
      risk_factors: ['Risk assessment unavailable; manual review recommended'],
    };
  }
}
