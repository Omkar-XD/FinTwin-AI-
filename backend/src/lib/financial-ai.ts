import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  generateRecommendationsWithLLM,
  formatRecommendationsAsText,
} from '../agents/recommendation-agent.js';
import {
  simulationProjectionSchema,
  simulateScenarioWithLLM,
  type SimulationProjection,
} from '../agents/scenario-simulation-agent.js';
import type { Json } from './database.types.js';
import { ENKRYPT_SAFE_FALLBACK, validateOutput, ValidationMode } from './enkrypt.js';
import type { SimulationValidationContext } from './validation/strategies/SimulationValidator.js';
import { resolveEnkryptStatus, type EnkryptStatus } from './enkrypt-status.js';
import { embedText, ensureCollectionAndUpsert, getQdrant, retrieveMemory } from './qdrant.js';
import { getSupabase } from './supabase.js';
import { invalidateDashboardCache } from './dashboard-cache.js';   
import { resolveCurrencySymbol } from './currency.js';
import {
  buildBaselineFinancialProfile,
  buildScenarioContext,
  normalizeScenarioParameters,
  type ScenarioContext,
  type ScenarioParameters,
  type ScenarioType,
} from './scenarios.js';

export async function updateExpenseCategories(
  userId: string,
  categories: { category: string; amount: number }[],
): Promise<{ monthlyExpenses: number; categories: { category: string; amount: number }[] }> {
  const monthlyExpenses = categories.reduce((sum, c) => sum + c.amount, 0);

  const { error: upsertError } = await getSupabase()
    .from('financial_profiles')
    .upsert(
      {
        user_id: userId,
        monthly_expenses: monthlyExpenses,
        categories,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (upsertError) {
    throw new Error(`Failed to update expense categories: ${upsertError.message}`);
  }

  await invalidateDashboardCache(userId);

  return { monthlyExpenses, categories };
}

export type ValidatedSimulationOutcome = SimulationProjection & {
  enkrypt_status: EnkryptStatus;
};

export type RunScenarioSimulationResult = {
  projectedOutcome: ValidatedSimulationOutcome;
  simulationId: string;
};

export type FreshRecommendationResult = {
  recommendationId: string;
  content: string;
  enkrypt_status: EnkryptStatus;
};

function buildFallbackProjection(
  profile: Record<string, unknown> | null,
  safeText: string,
): SimulationProjection {
  const netWorth = Number(profile?.['net_worth'] ?? 0);
  const cashFlow = Number(profile?.['cash_flow'] ?? 0);

  return {
    projectedNetWorth: {
      months12: netWorth,
      months24: netWorth,
      months36: netWorth,
    },
    projectedCashFlow: {
      months12: cashFlow,
      months24: cashFlow,
      months36: cashFlow,
    },
    narrative: safeText,
    assumptions: ['Projection replaced because validation did not pass.'],
    risks: ['Review this scenario with a qualified financial advisor before acting.'],
  };
}

async function getCurrentProfileAndRisk(userId: string) {
  const supabase = getSupabase();

  const [profileResult, riskResult] = await Promise.all([
    supabase
      .from('financial_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('risk_scores')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (riskResult.error) {
    throw riskResult.error;
  }

  return {
    profile: profileResult.data,
    riskScore: riskResult.data,
  };
}

export async function getCurrentRiskProfile(userId: string) {
  const { profile, riskScore } = await getCurrentProfileAndRisk(userId);
  return {
    financialProfile: profile,
    riskScore,
    currencySymbol: resolveCurrencySymbol(profile?.['currency'] as string | null),
  };
}

export async function runScenarioSimulation(
  userId: string,
  scenarioType: ScenarioType,
  params: Record<string, unknown> | ScenarioParameters = {},
): Promise<RunScenarioSimulationResult> {
  const supabase = getSupabase();
  const { profile, riskScore } = await getCurrentProfileAndRisk(userId);
  const currencySymbol = resolveCurrencySymbol(profile?.['currency'] as string | null);
  const baseline = buildBaselineFinancialProfile(profile as Record<string, unknown> | null, currencySymbol);
  const scenarioParameters = normalizeScenarioParameters(scenarioType, params);
  const scenarioContext = buildScenarioContext({
    baseline,
    scenarioType,
    scenarioParameters,
  });
  const memory = await retrieveMemory(
    userId,
    `past simulations current debt ${scenarioType} ${JSON.stringify(scenarioParameters)}`,
    { limit: 6 },
  );

  const context = {
    baselineFinancialProfile: baseline,
    financialProfile: profile,
    riskScore,
    currencySymbol,
    scenario: {
      type: scenarioType,
      params: scenarioParameters,
    },
    scenarioContext,
    memory,
  };

  const projection = await simulateScenarioWithLLM(context).catch((error) => {
    console.error('Scenario simulation generation failed; using fallback projection:', error);
    return buildFallbackProjection(profile, 'Unable to produce a projection from the available data.');
  });
  const simulationValidationContext: SimulationValidationContext = {
    scenarioContext: scenarioContext as ScenarioContext,
    currentProfile: profile as Record<string, unknown> | null,
    scenarioParameters,
    projection: {
      projectedNetWorth: projection.projectedNetWorth,
      projectedCashFlow: projection.projectedCashFlow,
      narrative: projection.narrative,
      assumptions: projection.assumptions,
      risks: projection.risks,
    },
    assumptions: projection.assumptions,
    projectionHorizon: '12/24/36 months',
  };

  const validation = await validateOutput({
    mode: ValidationMode.SIMULATION,
    text: JSON.stringify(projection),
    context: {
      ...context,
      simulationValidationContext,
    },
    metadata: {
      agentName: 'scenarioSimulationAgent',
      userId,
      scenarioType,
      projectionHorizon: '12/24/36 months',
    },
  });
  const enkryptStatus = resolveEnkryptStatus(
    validation.safetyPassed && validation.factualPassed,
    [...validation.safetyIssues, ...validation.factualIssues],
    validation.validationUnavailable,
  );
  const projectedOutcome = {
    ...(validation.safetyPassed ? projection : buildFallbackProjection(profile, ENKRYPT_SAFE_FALLBACK)),
    assumptions: projection.assumptions ?? [],
    risks: projection.risks ?? [],
    enkrypt_status: enkryptStatus,
  };

  const { data: savedSimulation, error: insertError } = await supabase
    .from('simulations')
    .insert({
      user_id: userId,
      scenario_type: scenarioType,
      input_params: scenarioParameters as Json,
      projected_outcome: projectedOutcome as Json,
    })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  const memorySummary = [
    `Simulation for user ${userId}`,
    `Scenario: ${scenarioType}`,
    `Params: ${JSON.stringify(scenarioParameters)}`,
    `Outcome: ${JSON.stringify(projectedOutcome)}`,
  ].join('\n');

  try {
    const vector = await embedText(memorySummary);
    await ensureCollectionAndUpsert(
      getQdrant(),
      userId,
      vector,
      {
        userId,
        type: 'simulation',
        scenarioType,
        simulationId: savedSimulation.id,
        summary: memorySummary,
        enkryptStatus,
        timestamp: new Date().toISOString(),
      },
      randomUUID(),
    );
  } catch (error) {
    console.error('Qdrant simulation memory failed; continuing without memory context:', error);
  }

  return {
    projectedOutcome,
    simulationId: savedSimulation.id,
  };
}

export async function getFreshRecommendation(
  userId: string,
  question?: string,
): Promise<FreshRecommendationResult> {
  const supabase = getSupabase();
  const { profile, riskScore } = await getCurrentProfileAndRisk(userId);

  const [profileHistory, pastRecommendations, rejectedFeedback] = await Promise.all([
    retrieveMemory(userId, 'financial profile history and snapshots', {
      type: 'profile_snapshot',
      limit: 3,
    }),
    retrieveMemory(userId, question ?? 'past financial recommendations', {
      type: 'recommendation',
      limit: 3,
    }),
    retrieveMemory(userId, question ?? 'rejected recommendations to avoid repeating', {
      type: 'recommendation_feedback',
      limit: 3,
    }),
  ]);

  const ragContext = {
    financialProfile: profile,
    riskScore,
    profileHistory,
    pastRecommendations,
    rejectedFeedback,
    userQuestion: question,
  };

  const result = await generateRecommendationsWithLLM(ragContext);
  const generatedText = formatRecommendationsAsText(result.recommendations);

  const validation = await validateOutput({
    mode: ValidationMode.RECOMMENDATION,
    text: generatedText,
    context: {
      financialProfile: profile,
      riskScore,
      profileHistory,
      pastRecommendations,
      userQuestion: question,
    },
    metadata: { agentName: 'recommendationAgent', userId },
  });

  const content = validation.finalText;
  const enkryptStatus = resolveEnkryptStatus(
    validation.safetyPassed && validation.factualPassed,
    [...validation.safetyIssues, ...validation.factualIssues],
    validation.validationUnavailable,
  );
  const status = validation.safetyPassed && validation.factualPassed ? 'approved' : 'pending_review';

  const { data: savedRecommendation, error: insertError } = await supabase
    .from('recommendations')
    .insert({
      user_id: userId,
      based_on_profile_id: profile?.id ?? null,
      content,
      enkrypt_status: enkryptStatus,
      status,
    })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  const recommendationSummary = [
    `Recommendations for user ${userId}`,
    content,
  ].join('\n\n');

  try {
    const vector = await embedText(recommendationSummary);
    await ensureCollectionAndUpsert(
      getQdrant(),
      userId,
      vector,
      {
        userId,
        type: 'recommendation',
        summary: recommendationSummary,
        enkryptStatus,
        status,
        timestamp: new Date().toISOString(),
      },
      randomUUID(),
    );
  } catch (error) {
    console.error('Qdrant recommendation memory failed; continuing without memory context:', error);
  }

  return {
    recommendationId: savedRecommendation.id,
    content,
    enkrypt_status: enkryptStatus,
  };
}

export const toolRequestContextSchema = z.object({
  userId: z.string(),
});
