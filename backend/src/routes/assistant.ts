import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import { answerAssistantQuestionWithLLM } from '../agents/assistant-agent.js';
import type { Json } from '../lib/database.types.js';
import { validateOutput, ValidationMode } from '../lib/enkrypt.js';
import { resolveEnkryptStatus } from '../lib/enkrypt-status.js';
import { runScenarioSimulation } from '../lib/financial-ai.js';
import { embedText, ensureCollectionAndUpsert, getQdrant, retrieveMemory } from '../lib/qdrant.js';
import type { AppBindings } from '../lib/auth.js';
import { getSupabase } from '../lib/supabase.js';
import { errorResponse, internalErrorMessage } from '../lib/http-error.js';
import {
  buildBaselineFinancialProfile,
  calculateSavingsTargetFromIncome,
  extractSavingsPercentQuestion,
} from '../lib/scenarios.js';
import { resolveCurrencySymbol } from '../lib/currency.js';

export const assistantRoutes = new Hono<AppBindings>();

const chatRequestSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1),
});

// --- Repetition detection -------------------------------------------------
// The model is instructed to avoid repeating itself, but instruction-following
// alone isn't reliable enough for this (especially at higher temperature).
// We detect repeats deterministically in code and hand the model an explicit
// flag + the prior answer, rather than making it infer repetition from raw
// conversation history on every turn.

const SHORT_CONFIRMATION_PATTERN =
  /^(y|yes|yeah|yep|sure|ok|okay|continue|go on|go ahead|more|tell me more|please continue)[.!?]*$/i;

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

// Jaccard similarity over word sets — cheap, deterministic, no extra network
// call needed since we're just comparing to the single previous user message.
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeForComparison(a).split(' ').filter(Boolean));
  const setB = new Set(normalizeForComparison(b).split(' ').filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const REPEAT_SIMILARITY_THRESHOLD = 0.6;

// --- Vague scenario detection ----------------------------------------------
// runScenarioSimulationTool's Zod schema requires a concrete scenarioType enum
// with no "unsure" option. When the user asks to "run a scenario" without
// specifying which one, the instructions tell the model to ask a clarifying
// question instead of guessing — but under load the model sometimes calls the
// tool anyway with near-empty params, which produces a weakly-grounded
// projection that Enkrypt then rejects and replaces with its generic safe
// fallback. Catching this deterministically in code, before any LLM/tool call,
// guarantees correct behavior and avoids burning a Groq call on a request we
// already know is unanswerable as written.

const VAGUE_SCENARIO_PATTERN =
  /\b(run|do|try|simulate|model)\b[^.?!]*\b(scenario|simulation)\b|\bwhat if\b/i;
const HAS_NUMBER = /\d/;

function isVagueScenarioRequest(message: string): boolean {
  return VAGUE_SCENARIO_PATTERN.test(message) && !HAS_NUMBER.test(message);
}

const SCENARIO_CLARIFYING_QUESTION =
  "I can run that projection — which scenario did you mean: a vehicle purchase, a new loan, increasing your investments, a salary change, increasing your savings, or early loan repayment? And what's the relevant amount (e.g. purchase price, loan amount, or salary change)?";

function formatMoney(symbol: string, value: number): string {
  return `${symbol}${value.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function detectRepeat(
  message: string,
  conversationHistory: { message: string; response: string }[],
): { isRepeat: boolean; previousAnswer: string | null } {
  const lastTurn = conversationHistory[conversationHistory.length - 1];
  if (!lastTurn || !lastTurn.message) {
    return { isRepeat: false, previousAnswer: null };
  }

  const isShortConfirmation = SHORT_CONFIRMATION_PATTERN.test(message.trim());
  const similarity = jaccardSimilarity(message, lastTurn.message);
  const isRepeat = isShortConfirmation || similarity >= REPEAT_SIMILARITY_THRESHOLD;

  return {
    isRepeat,
    previousAnswer: isRepeat ? lastTurn.response : null,
  };
}

assistantRoutes.post('/chat', async (c) => {
  try {
    const parsed = chatRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse(c, 400, 'Invalid request body', 'BAD_REQUEST');
    }

    const verifiedUserId = c.get('userId');
    const { userId, message } = parsed.data;
    if (userId !== verifiedUserId) {
      return errorResponse(c, 403, 'Forbidden', 'FORBIDDEN');
    }

  const supabase = getSupabase();

  if (isVagueScenarioRequest(message)) {
    const { error: insertError } = await supabase
      .from('chat_history')
      .insert({
        user_id: userId,
        message,
        response: SCENARIO_CLARIFYING_QUESTION,
        enkrypt_status: 'not_applicable',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to save chat exchange:', insertError);
    }

    return c.json({ answer: SCENARIO_CLARIFYING_QUESTION });
  }

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
      console.error('Failed to fetch financial profile:', profileResult.error);
      return errorResponse(c, 500, 'Failed to fetch financial profile', 'INTERNAL_ERROR');
    }

    if (riskResult.error) {
      console.error('Failed to fetch risk score:', riskResult.error);
      return errorResponse(c, 500, 'Failed to fetch risk score', 'INTERNAL_ERROR');
    }

    const savingsIncomePercent = extractSavingsPercentQuestion(message);
    if (savingsIncomePercent !== null) {
      const currencySymbol = resolveCurrencySymbol(profileResult.data?.currency ?? null);
      const baseline = buildBaselineFinancialProfile(
        profileResult.data as Record<string, unknown> | null,
        currencySymbol,
      );
      const target = calculateSavingsTargetFromIncome({
        baseline,
        savingsIncreasePercent: savingsIncomePercent,
      });

      const generatedAnswer = target.available
        ? [
            `Saving ${savingsIncomePercent}% of your monthly income would mean setting aside ${formatMoney(currencySymbol, target.targetSavings)} next month.`,
            baseline.savings == null
              ? 'I do not have a verified current savings balance to calculate the new total savings balance.'
              : `Added to your current savings of ${formatMoney(currencySymbol, baseline.savings)}, your total savings would be ${formatMoney(currencySymbol, baseline.savings + target.targetSavings)}.`,
          ].join(' ')
        : target.reason;

      await runScenarioSimulation(userId, 'increase_savings', {
        savingsIncreasePercent: savingsIncomePercent,
      }).catch((error) => {
        console.error('Deterministic savings scenario persistence failed; continuing chat response:', error);
      });

      const validation = await validateOutput({
        mode: ValidationMode.ASSISTANT,
        text: generatedAnswer,
        context: {
          financialProfile: profileResult.data,
          riskScore: riskResult.data,
          question: message,
        },
        metadata: { agentName: 'assistantAgent', userId },
      });

      const answer = validation.finalText;
      const enkryptStatus = resolveEnkryptStatus(
        validation.safetyPassed && validation.factualPassed,
        [...validation.safetyIssues, ...validation.factualIssues],
        validation.validationUnavailable,
      );

      const { error: insertError } = await supabase
        .from('chat_history')
        .insert({
          user_id: userId,
          message,
          response: answer,
          enkrypt_status: enkryptStatus,
        });

      if (insertError) {
        console.error('Failed to save chat exchange:', insertError);
        return errorResponse(c, 500, 'Failed to save chat exchange', 'INTERNAL_ERROR');
      }

      return c.json({ answer });
    }

    let messageEmbedding: number[] | null = null;
    try {
      messageEmbedding = await embedText(message);
    } catch (error) {
      console.error('Embedding failed for chat memory; continuing without memory upsert:', error);
    }

  const memory = await retrieveMemory(userId, message, { limit: 4 });

  // 2. Trim recent conversation to shorter excerpts, not full stored text
  const { data: recentHistory, error: historyError } = await supabase
    .from('chat_history')
    .select('message, response')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(4); // was 6 — 4 turns is usually enough for continuity questions

  if (historyError) {
    console.error('Failed to fetch recent chat history:', historyError);
  }

  const conversationHistory = (recentHistory ?? [])
    .reverse()
    .map((turn) => ({
      message: turn.message?.slice(0, 300) ?? '',
      response: turn.response?.slice(0, 300) ?? '',
    }));

  // 3. Only pull the fields the assistant actually reasons over —
  // not the full raw Supabase row (created_at, id, internal flags, etc.)
  const trimmedProfile = profileResult.data
  ? {
      monthlyIncome: profileResult.data.monthly_income,
      monthlyExpenses: profileResult.data.monthly_expenses,
      savings: profileResult.data.savings,
      netWorth: profileResult.data.net_worth,
      totalDebt: profileResult.data.total_debt,
      cashFlow: profileResult.data.cash_flow,
      healthScore: profileResult.data.health_score,
      categories: profileResult.data.categories,
    }
  : null;

  const trimmedRisk = riskResult.data
    ? {
        riskScore: riskResult.data.risk_score,
        cashFlowStatus: riskResult.data.cash_flow_status,
        savingsAdequacy: riskResult.data.savings_adequacy,
        riskFactors: riskResult.data.risk_factors,
        debtToIncome: riskResult.data.debt_to_income,
      }
    : null;

  const trimmedMemory = memory.map((m: any) => ({
    summary: m.summary ?? m.payload?.summary,
    timestamp: m.timestamp ?? m.payload?.timestamp,
  }));

  const { isRepeat, previousAnswer } = detectRepeat(message, conversationHistory);

  const context = {
    financialProfile: trimmedProfile,
    riskScore: trimmedRisk,
    recentConversation: conversationHistory,
    memory: trimmedMemory,
    repetitionCheck: {
      isLikelyRepeatOfPreviousQuestion: isRepeat,
      previousAnswerToAvoidRepeating: previousAnswer,
    },
  };

  const prompt = [
    'Answer the user question using only the verified financial profile, current risk score, recent conversation turns, and retrieved memory context.',
    'For "what did I just say" or continuity questions, prioritize recentConversation over memory — memory is for older/topical recall only.',
    'Use your tools when the question needs a fresh simulation, recommendation, or current profile/risk read.',
    'If the available data is insufficient, say what is missing and avoid guessing.',
    isRepeat
      ? 'IMPORTANT: context.repetitionCheck.isLikelyRepeatOfPreviousQuestion is true — the user is repeating or confirming their prior question. Do NOT repeat context.repetitionCheck.previousAnswerToAvoidRepeating or its phrasing/structure. Instead go deeper on a detail not yet covered, surface a different angle from the data, or ask a short specific question about what they want more detail on.'
      : '',
    'Context:',
    JSON.stringify(context), // no pretty-print indentation — saves tokens for zero benefit
    'User question:',
    message,
  ].filter(Boolean).join('\n\n');
    const requestContext = new RequestContext<{ userId: string }>([['userId', userId]]);
    const generatedAnswer = await answerAssistantQuestionWithLLM(prompt, requestContext);
    const toolsUsed: string[] = [];

  const validation = await validateOutput({
    mode: ValidationMode.ASSISTANT,
    text: generatedAnswer,
    context: {
      financialProfile: profileResult.data,
      riskScore: riskResult.data,
      memory,
      question: message,
    },
    metadata: { agentName: 'assistantAgent', userId },
  });

  const answer = validation.finalText;
  const enkryptStatus = resolveEnkryptStatus(
    validation.safetyPassed && validation.factualPassed,
    [...validation.safetyIssues, ...validation.factualIssues],
    validation.validationUnavailable,
  );

  const { data: savedExchange, error: insertError } = await supabase
    .from('chat_history')
    .insert({
      user_id: userId,
      message,
      response: answer,
      enkrypt_status: enkryptStatus,
    })
    .select('id')
    .single();

    if (insertError) {
      console.error('Failed to save chat exchange:', insertError);
      return errorResponse(c, 500, 'Failed to save chat exchange', 'INTERNAL_ERROR');
    }

  const memorySummary = [
    `Chat exchange for user ${userId}`,
    `Question: ${message}`,
    `Answer: ${answer}`,
  ].join('\n');

    if (messageEmbedding) {
      await ensureCollectionAndUpsert(
        getQdrant(),
        userId,
        messageEmbedding,
        {
          userId,
          type: 'chat_exchange',
          chatHistoryId: savedExchange.id,
          summary: memorySummary,
          question: message,
          answer,
          enkryptStatus,
          timestamp: new Date().toISOString(),
        },
        randomUUID(),
      );
    }

    return c.json({ answer });
  } catch (error) {
    console.error('Assistant chat route failed:', error);
    return errorResponse(
      c,
      500,
      internalErrorMessage(error, 'I could not complete that request. Please try again with a little more detail.'),
      'INTERNAL_ERROR',
    );
  }
});
