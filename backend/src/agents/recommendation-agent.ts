import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { callLLM, parseJsonFromLLM } from '../lib/llm.js';
import { GROQ_CHAT_MODEL } from '../lib/models.js';

export const recommendationOutputSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
      }),
    )
    .min(3)
    .max(4),
});

export type RecommendationOutput = z.infer<typeof recommendationOutputSchema>;

export const RECOMMENDATION_AGENT_INSTRUCTIONS = `You are a certified financial planning assistant. Using the user's verified financial profile, risk assessment, and retrieved historical context, generate exactly 3-4 personalized, actionable financial recommendations.

Rules:
- Ground every recommendation in the provided data — do not invent figures or facts.
- Tailor advice to the user's income, expenses, savings, debt, and risk factors.
- Prioritize practical steps the user can take in the next 30-90 days.
- Use clear, jargon-free language.
- Assign priority (high, medium, low) based on urgency and impact.
- If context includes "rejectedExamples", these are recommendations real users across the system previously rejected as unhelpful, too generic, or irrelevant. Do NOT produce recommendations with similar phrasing, structure, or substance to these — treat them as known failure patterns to avoid, regardless of how well they seem to fit this user's numbers.
- If context includes "approvedExamples", these are recommendations real users found valuable and approved. Favor similar specificity, tone, and structure to these — but always ground content in THIS user's actual data; never copy their numbers or facts verbatim.`;

export const recommendationAgent = new Agent({
  id: 'recommendationAgent',
  name: 'Recommendation Agent',
  instructions: RECOMMENDATION_AGENT_INSTRUCTIONS,
  model: GROQ_CHAT_MODEL,
});

export function formatRecommendationsAsText(
  recommendations: RecommendationOutput['recommendations'],
): string {
  return recommendations
    .map((rec, index) => {
      const priority = rec.priority ? ` [${rec.priority} priority]` : '';
      return `${index + 1}. ${rec.title}${priority}\n${rec.description}`;
    })
    .join('\n\n');
}

export async function generateRecommendationsWithLLM(
  ragContext: Record<string, unknown>,
  systemPrompt = RECOMMENDATION_AGENT_INSTRUCTIONS,
): Promise<RecommendationOutput> {
  try {
    const prompt = [
      'Generate exactly 3-4 personalized financial recommendations for this user.',
      'Return only JSON in this shape: {"recommendations":[{"title":"...","description":"...","priority":"high|medium|low"}]}.',
      'Ground every recommendation in the verified context below.',
      'Context:',
      JSON.stringify(ragContext),
    ].join('\n\n');

    const raw = await callLLM(prompt, systemPrompt);
    const parsed = parseJsonFromLLM<unknown>(raw, { recommendations: [] });
    const result = recommendationOutputSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Recommendation generation failed schema validation: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.error('recommendationAgent step failed:', error);
    throw error;
  }
}
