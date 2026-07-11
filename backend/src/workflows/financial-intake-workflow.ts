import { randomUUID } from 'node:crypto';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  financialProfileExtractionSchema,
} from '../agents/financial-profile-agent.js';
import { assessRiskWithLLM, type RiskAssessment } from '../agents/risk-detection-agent.js';
import {
  generateRecommendationsWithLLM,
  formatRecommendationsAsText,
} from '../agents/recommendation-agent.js';
import { getSupabase } from '../lib/supabase.js';
import { getQdrant, ensureCollectionAndUpsert, retrieveMemory, embedText } from '../lib/qdrant.js';
import { validateOutput, ValidationMode } from '../lib/enkrypt.js';
import { invalidateDashboardCache } from '../lib/dashboard-cache.js';
import { resolveEnkryptStatus } from '../lib/enkrypt-status.js';

const workflowInputSchema = z.object({
  documentId: z.string(),
  userId: z.string(),
  docType: z.string(),
  filePath: z.string(),
  extraction: financialProfileExtractionSchema,
});

const workflowOutputSchema = z.object({
  documentId: z.string(),
  userId: z.string(),
  status: z.string(),
});

const workflowStateSchema = z.object({
  documentId: z.string().optional(),
  userId: z.string().optional(),
});

const riskAwareInputSchema = z.object({
  documentId: z.string(),
  userId: z.string(),
  extractedText: z.string(),
  extraction: z.any(),
  profileId: z.string().optional(),
  summary: z.string().optional(),
  riskAssessment: z.any(),
});

const recommendationPathOutputSchema = riskAwareInputSchema.extend({
  recommendationId: z.string().optional(),
  recommendationStatus: z.enum(['approved', 'pending_review']).optional(),
});

const branchedRecommendationOutputSchema = z.object({
  normalRiskPath: recommendationPathOutputSchema.optional(),
  criticalRiskPath: recommendationPathOutputSchema.optional(),
});

async function markDocumentFailed(
  documentId: string | undefined,
  error: unknown,
): Promise<void> {
  if (!documentId) {
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown workflow error';
  try {
    await getSupabase()
      .from('documents')
      .update({ status: 'failed', error_message: message })
      .eq('id', documentId);
  } catch (statusError) {
    console.error('Failed to mark document as failed:', statusError);
  }
}

async function persistRecommendationMemory(
  userId: string,
  summary: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const vector = await embedText(summary);
    await ensureCollectionAndUpsert(
      getQdrant(),
      userId,
      vector,
      payload,
      randomUUID(),
    );
  } catch (error) {
    console.error('Qdrant recommendation memory failed; continuing workflow:', error);
  }
}

async function validateProfileExtraction(inputData: z.infer<typeof workflowInputSchema>): Promise<void> {
  const validation = await validateOutput({
    mode: ValidationMode.FACTUAL,
    text: JSON.stringify(inputData.extraction),
    context: {
      docType: inputData.docType,
      extraction: inputData.extraction,
      verifiedSummary: inputData.extraction.summary,
    },
    metadata: {
      agentName: 'financialProfileAgent',
      userId: inputData.userId,
      workflowStep: 'extract-profile',
      documentId: inputData.documentId,
    },
  });

  if (!validation.safetyPassed) {
    throw new Error(
      `Financial profile extraction failed safety validation: ${validation.safetyIssues.join('; ')}`,
    );
  }
}

async function validateRiskAssessment(
  inputData: {
    documentId: string;
    userId: string;
    extraction?: unknown;
  },
  analysisContext: Record<string, unknown>,
  riskAssessment: RiskAssessment,
): Promise<RiskAssessment> {
  const validation = await validateOutput({
    mode: ValidationMode.RISK_ANALYSIS,
    text: JSON.stringify(riskAssessment),
    context: {
      ...analysisContext,
      riskScore: riskAssessment,
    },
    metadata: {
      agentName: 'riskDetectionAgent',
      userId: inputData.userId,
      workflowStep: 'assess-risk',
      documentId: inputData.documentId,
      riskScoreSource: 'document-analysis',
    },
  });

  if (validation.safetyPassed) {
    return riskAssessment;
  }

  return {
    debt_to_income: null,
    credit_utilization: null,
    cash_flow_status: 'unknown',
    savings_adequacy: 'unknown',
    risk_score: 50,
    risk_factors: [
      'Risk assessment replaced because safety validation failed; manual review recommended',
    ],
  };
}

async function runRecommendationPath(
  inputData: z.infer<typeof riskAwareInputSchema>,
  options: { critical: boolean },
): Promise<z.infer<typeof recommendationPathOutputSchema>> {
  const supabase = getSupabase();

  const { data: profile, error: profileError } = await supabase
    .from('financial_profiles')
    .select('*')
    .eq('user_id', inputData.userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const [profileHistory, pastRecommendations] = await Promise.all([
    retrieveMemory(inputData.userId, 'financial profile history and snapshots', {
      type: 'profile_snapshot',
      limit: 3,
    }),
    retrieveMemory(inputData.userId, 'past financial recommendations', {
      type: 'recommendation',
      limit: 3,
    }),
  ]);

  const ragContext = {
    financialProfile: profile,
    riskScore: inputData.riskAssessment,
    profileHistory,
    pastRecommendations,
    latestExtraction: {
      summary: inputData.extraction?.summary,
      monthlyIncome: inputData.extraction?.income?.monthlyIncome,
      monthlyExpenses: inputData.extraction?.expenses?.monthlyExpenses,
      transactionCount: inputData.extraction?.transactions?.length ?? 0,
    },
    path: options.critical ? 'criticalRiskPath' : 'normalRiskPath',
  };

  const criticalSystemPrompt = `You are a financial stabilization specialist. The user is in critical financial risk.
Focus on urgent debt, cash-flow, liquidity, bill-prioritization, and harm-reduction steps for the next 7-30 days.
Do not suggest speculative investments or risky borrowing. Keep advice practical, conservative, and grounded in verified data.`;

  const recommendationOutput = await generateRecommendationsWithLLM(
    ragContext,
    options.critical ? criticalSystemPrompt : undefined,
  );

  const generatedText = formatRecommendationsAsText(recommendationOutput.recommendations);
  const validation = await validateOutput({
    mode: ValidationMode.RECOMMENDATION,
    text: generatedText,
    context: {
      financialProfile: profile,
      riskScore: inputData.riskAssessment,
      profileHistory,
      pastRecommendations,
      latestExtraction: ragContext.latestExtraction,
      path: ragContext.path,
    },
    metadata: {
      agentName: 'recommendationAgent',
      userId: inputData.userId,
      workflowStep: options.critical ? 'criticalRiskPath' : 'normalRiskPath',
    },
  });

  const finalContent = validation.finalText;
  const recommendationStatus = validation.safetyPassed && validation.factualPassed ? 'approved' : 'pending_review';
  const enkryptStatus = resolveEnkryptStatus(
    validation.safetyPassed && validation.factualPassed,
    [...validation.safetyIssues, ...validation.factualIssues],
    validation.validationUnavailable,
  );

  const { data: savedRecommendation, error: insertError } = await supabase
    .from('recommendations')
    .insert({
      user_id: inputData.userId,
      based_on_profile_id: inputData.profileId ?? profile?.id ?? null,
      content: finalContent,
      enkrypt_status: enkryptStatus,
      status: recommendationStatus,
    })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  const recommendationSummary = [
    `Recommendations for user ${inputData.userId}`,
    finalContent,
  ].join('\n\n');

  await persistRecommendationMemory(inputData.userId, recommendationSummary, {
    userId: inputData.userId,
    type: 'recommendation',
    summary: recommendationSummary,
    enkryptStatus,
    recommendationStatus,
    timestamp: new Date().toISOString(),
  });

  return {
    ...inputData,
    recommendationId: savedRecommendation.id,
    recommendationStatus,
  };
}

const extractProfileStep = createStep({
  id: 'extract-profile',
  inputSchema: workflowInputSchema,
  outputSchema: z.object({
    documentId: z.string(),
    userId: z.string(),
    extractedText: z.string(),
    extraction: z.any(),
  }),
  async execute({ inputData }) {
    try {
      const extraction = inputData.extraction;

      console.log("\n========== EXTRACT PROFILE OUTPUT ==========");
      console.log(JSON.stringify(extraction, null, 2));
      console.log("============================================\n");

      await validateProfileExtraction(inputData);

      return {
        documentId: inputData.documentId,
        userId: inputData.userId,
        extractedText: extraction.summary,
        extraction,
      };
    } catch (error) {
      console.error('extract-profile workflow step failed:', error);
      await markDocumentFailed(inputData.documentId, error);
      throw error;
    }
  },
});

const assessRiskStep = createStep({
  id: 'assess-risk',
  inputSchema: z.object({
    documentId: z.string(),
    userId: z.string(),
    extractedText: z.string(),
    extraction: z.any(),
    profileId: z.string().optional(),
    summary: z.string().optional(),
  }),
  outputSchema: z.object({
    documentId: z.string(),
    userId: z.string(),
    extractedText: z.string(),
    extraction: z.any(),
    profileId: z.string().optional(),
    summary: z.string().optional(),
    riskAssessment: z.any(),
  }),
  async execute({ inputData }) {
    try {
      const supabase = getSupabase();

      const { data: currentProfile, error: profileError } = await supabase
        .from('financial_profiles')
        .select('*')
        .eq('user_id', inputData.userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const historicalMemories = await retrieveMemory(
        inputData.userId,
        'financial profile snapshot and risk history',
        { limit: 3 },
      );

      const analysisContext = {
        currentProfile,
        extractedData: {
          summary: inputData.extraction?.summary,
          monthlyIncome: inputData.extraction?.income?.monthlyIncome,
          monthlyExpenses: inputData.extraction?.expenses?.monthlyExpenses,
          categories: inputData.extraction?.expenses?.categories,
          accountBalance: inputData.extraction?.accountBalance,
          transactionCount: inputData.extraction?.transactions?.length ?? 0,
        },
        historicalSnapshots: historicalMemories,
      };

      const generatedRiskAssessment = await assessRiskWithLLM(analysisContext);
      const riskAssessment = await validateRiskAssessment(
        inputData,
        analysisContext,
        generatedRiskAssessment,
      );

      const riskPayload = {
        user_id: inputData.userId,
        debt_to_income: riskAssessment.debt_to_income ?? null,
        credit_utilization: riskAssessment.credit_utilization ?? null,
        cash_flow_status: riskAssessment.cash_flow_status,
        savings_adequacy: riskAssessment.savings_adequacy,
        risk_score: riskAssessment.risk_score,
        risk_factors: riskAssessment.risk_factors,
      };

    const { data: existingRisk, error: riskFetchError } = await supabase
      .from('risk_scores')
      .select('id')
      .eq('user_id', inputData.userId)
      .maybeSingle();

    if (riskFetchError) {
      throw riskFetchError;
    }

    if (existingRisk?.id) {
      const { error: riskUpdateError } = await supabase
        .from('risk_scores')
        .update(riskPayload)
        .eq('id', existingRisk.id);
      if (riskUpdateError) {
        throw riskUpdateError;
      }
    } else {
      const { error: riskInsertError } = await supabase
        .from('risk_scores')
        .insert(riskPayload);
      if (riskInsertError) {
        throw riskInsertError;
      }
    }

      return {
        documentId: inputData.documentId,
        userId: inputData.userId,
        extractedText: inputData.extractedText,
        extraction: inputData.extraction,
        profileId: inputData.profileId,
        summary: inputData.summary,
        riskAssessment,
      };
    } catch (error) {
      console.error('assess-risk workflow step failed:', error);
      await markDocumentFailed(inputData.documentId, error);
      throw error;
    }
  },
});

function extractYearFromSummary(summary: string | undefined): number | undefined {
  const match = summary?.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function normalizeTransactionDate(
  rawDate: string | null | undefined,
  fallbackYear?: number,
): string | null {
  if (!rawDate) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return rawDate;
  }

  const mmdd = rawDate.match(/^(\d{2})-(\d{2})$/);
  if (mmdd) {
    const year = fallbackYear ?? new Date().getFullYear();
    return `${year}-${mmdd[1]}-${mmdd[2]}`;
  }

  const parsed = new Date(rawDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

// Normalizes Gemini's free-text type values ("withdrawal", "deposit", etc.)
// to the two values the DB CHECK constraint actually allows: 'credit' | 'debit'
function normalizeTransactionType(rawType: string | null | undefined, amount: number | null): string {
  const t = rawType?.toLowerCase() ?? '';
  if (t.includes('credit') || t.includes('deposit')) return 'credit';
  if (t.includes('debit') || t.includes('withdraw') || t.includes('check') || t.includes('fee')) return 'debit';
  if (amount != null) return amount < 0 ? 'debit' : 'credit';
  return 'debit';
}

function roundCurrency(value: number | null): number | null {
  if (value == null) return null;
  return Math.round(value * 100) / 100;
}
function normalizeCurrencySymbol(currencyCode: string | null | undefined): string {
  const code = currencyCode?.toUpperCase() ?? '';
  if (code === 'USD') return '$';
  if (code === 'INR' || code === '') return '₹'; // default to ₹ when unlabeled
  return code; // fallback: show the raw code (EUR, GBP, etc.) if it's something else
}

const persistProfileStep = createStep({
  id: 'persist-profile',
  inputSchema: z.object({
    documentId: z.string(),
    userId: z.string(),
    extractedText: z.string(),
    extraction: z.any(),
    riskAssessment: z.any().optional(),
  }),
  outputSchema: z.object({
    documentId: z.string(),
    userId: z.string(),
    extractedText: z.string(),
    extraction: z.any(),
    profileId: z.string().optional(),
    summary: z.string().optional(),
  }),
  async execute({ inputData }) {
    try {
      const supabase = getSupabase();

      console.log("\n========== PERSIST PROFILE INPUT ==========");
      console.log(JSON.stringify(inputData, null, 2));
      console.log("===========================================\n");

      const extraction = inputData.extraction;

      if (!extraction) {
        throw new Error(
          `Workflow did not receive extraction from extractProfileStep.\nReceived input:\n${JSON.stringify(inputData, null, 2)}`
        );
      }

      // Build transaction rows + computed expenses FIRST, before profilePayload needs them.
      const fallbackYear = extractYearFromSummary(extraction.summary);

      type TransactionRow = {
        user_id: string;
        document_id: string;
        amount: number | null;
        category: string | null;
        date: string | null;
        merchant: string | null;
        type: string | null;
      };

      const transactionRows: TransactionRow[] = (extraction.transactions ?? []).map(
        (transaction: Record<string, unknown>): TransactionRow => ({
          user_id: inputData.userId,
          document_id: inputData.documentId,
          amount: (transaction['amount'] as number | null | undefined) ?? null,
          category: (transaction['category'] as string | null | undefined) ?? null,
          date: normalizeTransactionDate(transaction['date'] as string | null | undefined, fallbackYear),
          merchant: (transaction['merchant'] as string | null | undefined) ?? null,
          type: normalizeTransactionType(
            transaction['type'] as string | null | undefined,
            (transaction['amount'] as number | null | undefined) ?? null,
          ),
        }),
      );

      const computedExpenses = transactionRows
        .filter((t: TransactionRow) => t.amount != null && t.type?.toLowerCase() !== 'credit')
        .reduce((sum: number, t: TransactionRow) => sum + Math.abs(t.amount as number), 0);
      
      const computedIncome = transactionRows
        .filter((t: TransactionRow) => t.amount != null && t.type === 'credit')
        .reduce((sum: number, t: TransactionRow) => sum + Math.abs(t.amount as number), 0);

      // Derive category breakdown from itemized transactions as a fallback
      const categoryTotals = transactionRows.reduce((acc: Record<string, number>, t: TransactionRow) => {
        if (t.amount == null || t.type?.toLowerCase() === 'credit') return acc;
        const key = t.category ?? 'Other';
        acc[key] = (acc[key] ?? 0) + Math.abs(t.amount);
        return acc;
      }, {});

      const derivedCategories = Object.entries(categoryTotals).map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
      }));

      const { data: existingProfile, error: fetchError } = await supabase
        .from('financial_profiles')
        .select('id, total_debt')
        .eq('user_id', inputData.userId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      const finalIncome = computedIncome > 0 ? computedIncome : extraction.income?.monthlyIncome ?? 0;
      const finalExpenses = computedExpenses > 0 ? computedExpenses : extraction.expenses?.monthlyExpenses ?? 0;

      const profilePayload = {
        user_id: inputData.userId,
        currency: extraction.income?.currency ?? 'INR',
        monthly_income: roundCurrency(finalIncome || null),
        monthly_expenses: roundCurrency(finalExpenses || null),
        categories:
          (extraction.expenses?.categories?.length ? extraction.expenses.categories : derivedCategories) ?? null,
        cash_flow: roundCurrency(finalIncome - finalExpenses),
        net_worth: extraction.accountBalance ?? null,
        savings: extraction.accountBalance ?? null,
        total_debt: roundCurrency(extraction.debt?.totalOutstandingDebt ?? existingProfile?.total_debt ?? null),
        health_score: null,
        updated_at: new Date().toISOString(),
      };

      let profileId = existingProfile?.id;

      if (profileId) {
        const { error: updateError } = await supabase
          .from('financial_profiles')
          .update(profilePayload)
          .eq('id', profileId);
        if (updateError) {
          throw updateError;
        }
      } else {
        const { data, error: insertError } = await supabase
          .from('financial_profiles')
          .insert(profilePayload)
          .select('id')
          .single();
        if (insertError) {
          throw insertError;
        }
        profileId = data?.id;
      }

      if (!profileId) {
        throw new Error('Failed to create or update financial profile');
      }

      if (transactionRows.length > 0) {
        const { error: transactionsError } = await supabase
          .from('transactions')
          .insert(transactionRows);
        if (transactionsError) {
          throw transactionsError;
        }
      }

      const summary = [
        `User monthly income: ${extraction.income?.monthlyIncome ?? 'unknown'}`,
        `User monthly expenses: ${profilePayload.monthly_expenses ?? 'unknown'}`,
        `Account balance: ${extraction.accountBalance ?? 'unknown'}`,
        `Extracted ${transactionRows.length} transactions`,
      ].join('\n');

      try {
        const vector = await embedText(summary);
        await ensureCollectionAndUpsert(
          getQdrant(),
          inputData.userId,
          vector,
          {
            userId: inputData.userId,
            type: 'profile_snapshot',
            summary,
            timestamp: new Date().toISOString(),
          },
          profileId,
        );
      } catch (error) {
        console.error('Qdrant profile memory failed; continuing workflow:', error);
      }

      return {
        documentId: inputData.documentId,
        userId: inputData.userId,
        extractedText: inputData.extractedText,
        extraction,
        profileId,
        summary,
        riskAssessment: inputData.riskAssessment,
      };
    } catch (error) {
      console.error('persist-profile workflow step failed:', error);
      await markDocumentFailed(inputData.documentId, error);
      throw error;
    }
  },
});

const normalRecommendationPathStep = createStep({
  id: 'normalRiskPath',
  inputSchema: riskAwareInputSchema,
  outputSchema: recommendationPathOutputSchema,
  async execute({ inputData }) {
    try {
      return await runRecommendationPath(inputData, { critical: false });
    } catch (error) {
      console.error('normalRiskPath workflow step failed:', error);
      await markDocumentFailed(inputData.documentId, error);
      throw error;
    }
  },
});

const criticalRecommendationPathStep = createStep({
  id: 'criticalRiskPath',
  inputSchema: riskAwareInputSchema,
  outputSchema: recommendationPathOutputSchema,
  async execute({ inputData }) {
    try {
      const { error: priorityError } = await getSupabase()
        .from('financial_profiles')
        .update({ priority_review: true })
        .eq('user_id', inputData.userId);

      if (priorityError) {
        throw priorityError;
      }

      return await runRecommendationPath(inputData, { critical: true });
    } catch (error) {
      console.error('criticalRiskPath workflow step failed:', error);
      await markDocumentFailed(inputData.documentId, error);
      throw error;
    }
  },
});

const humanReviewGateStep = createStep({
  id: 'human-review-gate',
  inputSchema: branchedRecommendationOutputSchema,
  outputSchema: recommendationPathOutputSchema,
  async execute({ inputData }) {
    const selected = inputData.criticalRiskPath ?? inputData.normalRiskPath;

    if (!selected) {
      throw new Error('Recommendation branch did not produce an output');
    }

    if (selected.recommendationStatus === 'pending_review') {
      console.log(
        `Recommendation ${selected.recommendationId} saved as pending_review for human approval`,
      );
    }

    return selected;
  },
});

const invalidateDashboardCacheStep = createStep({
  id: 'invalidate-dashboard-cache',
  inputSchema: z.object({
    documentId: z.string(),
    userId: z.string(),
    extraction: z.any(),
    profileId: z.string().optional(),
    summary: z.string().optional(),
    recommendationId: z.string().optional(),
  }),
  outputSchema: z.object({
    documentId: z.string(),
    userId: z.string(),
    status: z.string(),
  }),
  async execute({ inputData }) {
    try {
      const supabase = getSupabase();
      await invalidateDashboardCache(inputData.userId);

      const { error } = await supabase
        .from('documents')
        .update({ status: 'completed', error_message: null })
        .eq('id', inputData.documentId);

      if (error) {
        throw error;
      }

      return {
        documentId: inputData.documentId,
        userId: inputData.userId,
        status: 'completed',
      };
    } catch (error) {
      console.error('invalidate-dashboard-cache workflow step failed:', error);
      await markDocumentFailed(inputData.documentId, error);
      throw error;
    }
  },
});

export const financialIntakeWorkflow = createWorkflow({
  id: 'financial-intake-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
  stateSchema: workflowStateSchema,
  steps: [
    extractProfileStep,
    persistProfileStep,
    assessRiskStep,
    criticalRecommendationPathStep,
    normalRecommendationPathStep,
    humanReviewGateStep,
    invalidateDashboardCacheStep,
  ],
})
  .then(extractProfileStep)
  .then(persistProfileStep)
  .then(assessRiskStep)
  .branch([
    [
      async ({ inputData }) => Number(inputData.riskAssessment?.risk_score ?? 0) > 75,
      criticalRecommendationPathStep,
    ],
    [
      async ({ inputData }) => Number(inputData.riskAssessment?.risk_score ?? 0) <= 75,
      normalRecommendationPathStep,
    ],
  ])
  .then(humanReviewGateStep)
  .then(invalidateDashboardCacheStep)
  .commit();
