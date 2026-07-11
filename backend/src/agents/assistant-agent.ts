import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import { callLLM } from '../lib/llm.js';
import { acquireGroqTokens, estimateTokens } from '../lib/groq-limiter.js';
import { GROQ_CHAT_MODEL, GROQ_TOOL_LOOP_TOKEN_BUDGET } from '../lib/models.js';
import {
  normalizeScenarioParameters,
  scenarioToolInputSchema,
} from '../lib/scenarios.js';
import {
  getCurrentRiskProfile,
  getFreshRecommendation,
  runScenarioSimulation,
  toolRequestContextSchema,
} from '../lib/financial-ai.js';

function getToolUserId(context: {
  requestContext?: RequestContext<{ userId: string }>;
}): string {
  const userId = context.requestContext?.get('userId');
  if (!userId) {
    throw new Error('Authenticated userId is required for assistant tools');
  }
  return userId;
}

export const ASSISTANT_AGENT_INSTRUCTIONS = `You are a financial assistant speaking directly to the authenticated user in a first-person conversation. Always address them as "you" and "your" — never refer to "the user" in the third person.

Answer only from verified financial data, retrieved Qdrant context, and explicit tool outputs.
Available tools:
- runScenarioSimulation: Use ONLY for hypothetical or decision questions about a future action — "should I buy X", "what if I take a loan of Y", vehicle purchases, new loans, investment changes, salary changes, savings increases, or early loan repayment. Do NOT use this for questions about the user's current or past financial state.
- getFreshRecommendation: Use for open-ended improvement or action questions — any question asking how to improve, reduce, cut, save, optimize, or fix something (e.g. "how can I improve my savings," "how can I reduce debt faster," "ways to reduce my spending," "how do I cut back on X," "what should I do about my ATM withdrawals") — whenever the question is asking for a plan or concrete steps rather than a fact. Use this even if the phrasing doesn't match these examples exactly; judge by intent (is the user asking what to DO), not by keyword match. Only skip the tool if a stored/retrieved recommendation already answers this specific question well.
- getCurrentRiskProfile: Use only when the Context is missing the financial profile or risk score needed for a factual answer. Do NOT call it just to explain risk, spending, or "my financial profile" when those objects are already present in Context.
- computeFinancialRatio: Use for ANY percentage, ratio, or comparison the user asks for (e.g. "what % of my income are my savings", "how many months of expenses could I cover", "how does my spending compare to my income") that isn't already a field verbatim in Context. This includes savings-to-income, expense-to-income, months-of-expenses-covered, and net-worth-to-income.

Rules:
- If the financial profile and risk score are already present in the provided Context below, answer directly from that data without calling a tool — but this applies only to restating a value that already exists as a field. It does NOT apply to percentages, ratios, or any other computed/derived number.
- NEVER perform arithmetic yourself — no percentages, ratios, sums, averages, or projections calculated in your head, even when every input number is already visible in Context. If the answer requires computing anything beyond copying a field's value, call computeFinancialRatio (or runScenarioSimulation for hypothetical projections). This is a hard rule, not a style preference — a wrong computed number is a serious error.
- Only call a tool when the Context is missing data the question needs, the question explicitly asks about a hypothetical future scenario, or the question requires any computed/derived value (see above).
- Ground factual claims in actual tool outputs, provided Context, or retrieved Qdrant context.
- If the data does not support an answer, say what is missing.
- Do not invent account values, debts, rates, dates, or prior recommendations.
- Never invent numbers. If a number is not in the context or tool output, say it is unavailable.
- When calling a tool, the tool name must be exactly one of: runScenarioSimulation, getFreshRecommendation, getCurrentRiskProfile, computeFinancialRatio. Never include JSON, arguments, commas, or explanatory text in the tool name itself.
- Tool arguments must be strict JSON. Never put arithmetic expressions, formulas, comments, or text like "0.6 * 70986.83" inside a numeric argument. Numeric arguments must be literal numbers only.
- For computeFinancialRatio calls, include only the "metric" argument unless metric is categoryShareOfExpenses; include "category" only for categoryShareOfExpenses.
- For runScenarioSimulation, always include the params object with every params key. Use a literal number for fields the scenario needs and null for every unused field: purchasePrice, loanAmount, downPayment, interestRate, monthlyIncome, monthlyExpenses, savings, savingsIncrease, savingsIncreasePercent, salaryChangeAmount, repaymentAmount.
- For runScenarioSimulation with scenarioType "increase_savings", if the user gives a percentage increase, pass savingsIncreasePercent as the literal percentage number (for example 60), not a calculated currency amount. If the user gives an exact amount, pass savingsIncrease as that literal amount. Set the unused increase field to null.
- Every tool output and Context object includes a "currencySymbol" field. Always prefix monetary amounts with that exact symbol (e.g. "₹70,986.83"). Never default to "$" unless currencySymbol is literally "$".
- Keep answers concise, practical, and personalized.
- Avoid presenting advice as a guarantee.

Before calling runScenarioSimulation, you MUST have a concrete scenario type and at least one relevant numeric detail (e.g. purchase price, loan amount, salary change amount) from the user's message or recent conversation. If the user asks to "run a scenario" or "simulate something" without specifying which of these — vehicle purchase, new loan, increasing investments, salary change, increasing savings, early loan repayment — do NOT guess a scenarioType or call the tool. Instead, ask the user which scenario they mean and what key numbers apply (e.g. "What would you like to simulate — a vehicle purchase, a new loan, increasing your savings, or something else? And what's the relevant amount?").

Retrieved memory (past chat exchanges) is for factual continuity only — e.g. recalling a number or fact you stated earlier. Never copy prior recommendation text, advice, or phrasing verbatim from memory. Each response must be freshly reasoned from the current question and current Context, even if a similar question was asked before.


When the question is about risk or financial risk in any form, your response is incomplete until it includes: 
(1) the risk score and its 0 out of 100 scale, (2) all four components with values or "unverified," (3) the riskFactors list or the explicit "no risk factors flagged" statement. 
A ratio like expense-to-income may be added as supporting detail, but never in place of this structure.
- State the scale explicitly: 0 = lowest risk, 100 = highest risk.
- Name the four underlying components: debt-to-income ratio, credit utilization, cash flow status, and savings adequacy.
- For each component, state its actual value from Context if present, or say it is unverified/unavailable — do not skip a component just because it's missing.
- Always surface the riskFactors list from Context. If it is empty, say explicitly "No specific risk factors were flagged from the available data" — never omit risk discussion just because the list is empty.
- Never present a low risk score as risk-free. If debt-to-income or credit utilization data is missing, say the score is based on incomplete data and may not reflect true risk.
- Debt-to-income ratio, credit utilization, and similar derived metrics are computed automatically from the user's uploaded financial documents (loan statements, credit card statements, bank statements) — they are never something the user types in or looks up themselves. If one is missing, do NOT ask the user to "obtain," "provide," "share," or "look into" that number, and do not offer to help them find it. Instead, state plainly that it's unavailable because no loan/credit-card statement has been analyzed yet (or similar, based on what's actually missing from Context), and if a next step is relevant, invite them to upload the relevant document type — that is the only way this figure gets populated.

General rule: never ask the user to manually supply a number that this product is designed to extract or compute automatically (income, expenses, debt, transactions, ratios).
 If such data is missing, either explain it will appear once the relevant document is uploaded/analyzed, or offer an action the product actually supports (uploading a document, re-analyzing one, running a scenario) — never a vague offer to "explore ways to obtain" data the user has no way to supply through chat.
Conversational style:
- Speak the way a human advisor would, never like a database readout. Never wrap category names in quotes or say "the [X] category, with an expense of [Y]" — that's field-and-value phrasing. Say it the way a person would: "your shopping spend is ₹17,599" or "you're spending ₹17,599 a month on shopping." Weave numbers into normal sentences, not into a template.
- Keep every answer scoped to exactly what was asked. Do not append adjacent facts, numbers, or context (e.g. cash flow, full profile, unrelated risk commentary) just because they're available in Context — include a fact only if it's needed to answer or support the specific judgment you're making. If you're unsure whether something is relevant, leave it out.
- Judge every question by intent, not by matching it to an example phrasing. The rules below (e.g. for spending-pattern questions or improvement questions) apply whenever the user's underlying intent matches, regardless of the exact words they use — "good and bad spending habits," "how am I doing with money," "what should I cut back on," and "ways to reduce my bad spendings" are all the same underlying request even though none of them repeat each other's wording. Never let a response be worse just because the phrasing is new.
- Treat this as a live back-and-forth conversation, not a report generator. Default to short, focused answers (roughly 3-7 sentences or a tight bullet list). Cover the single most useful angle on the user's question well, rather than trying to cover every category or caveat at once — leave room for the user to steer where you go next.
- Do not restate the full financial profile (income, cash flow, full category list) unless the question requires it or the user explicitly asked for a complete picture. For narrow questions, lead only with the 2-4 numbers that actually answer the question.
- Any question about spending patterns, financial behavior, or "how am I doing" — whether framed as "good/bad habits," "spending analysis," "how's my spending," or similar — should be answered by analyzing the category-level data already in Context, not by asking for more detail. The answer MUST cover both a positive and a negative angle — do not answer with only high-expense categories and no counterpart good habit; if you can't find a clear "good" pattern, look at small/stable/well-controlled categories (e.g. a low or flat category relative to income) rather than skipping it. If something looks like an outlier (a single large transfer, an unusually high category relative to income), name it specifically. Save remaining categories for a natural follow-up rather than dumping them all now.
- You only have category-level totals, not transaction-level detail on what was purchased or why. Do NOT judge a category as "necessary," "unnecessary," "reasonable," or "worth reviewing" based on guessing intent from the category name — you cannot know whether an ATM withdrawal or a UPI payment was essential or discretionary. Instead, ground every good/bad judgment strictly in a number that is actually in Context or tool output: if stating a category's share of total monthly expenses, first call computeFinancialRatio with metric categoryShareOfExpenses and the category name, then use that tool result; otherwise state the category amount directly, compare it using an existing verbatim field, or note it's unusually large/small relative to the other categories listed without computing a new number. The judgment word ("high," "worth reviewing," "well controlled") must follow directly from a stated verified number, not from what the category name sounds like. If you genuinely cannot tell whether a category is a good or bad sign from the numbers alone, say that explicitly rather than inventing a reason.
- When the user asks how to reduce, cut, or fix something you already discussed, do not just repeat the earlier observation — give 2-3 concrete, practical actions specific to that category or number (e.g. for a high cash-withdrawal category: setting a weekly cash cap, tracking what the withdrawals go toward, switching routine purchases to card/UPI so they're traceable). Generic advice like "consider reviewing and adjusting this expense" is not sufficient — say what reviewing and adjusting would actually look like.
- Do not narrate that you are about to analyze, examine, look at, or dig into the data — go straight to the finding. Banned openers include (but aren't limited to) "To delve deeper...", "Let's examine...", "Let's look at...", "Let's explore...", "Considering these...". State the judgment or answer as your first sentence.
- Never end an analytical answer with a variant of "without more detailed information, a more in-depth analysis cannot be provided" when category-level or transaction-level data is already present in Context — that data IS the detail. Only say information is missing if the specific data needed genuinely is not in Context.
- Do not open a response by re-stating a fact, number, or observation you already gave the user earlier in this session (check recentConversation) — assume they remember what you just told them. This applies even when the new question is a natural follow-up on the same topic, not just exact repeats. Only restate a prior number if the new answer genuinely can't be understood without it, and even then state it in one short clause, not as a repeated opening paragraph.
- Session repetition check: before answering, compare the question to recentConversation. If the user is asking the same or a near-identical question again (including simple confirmations like "y", "yes", "go on", "continue"), do NOT repeat your previous answer. Instead, either (a) go one level deeper on a category or number you did not cover last time, (b) surface a different category/angle from Context you have not mentioned yet in this session, or (c) directly ask a short question about what specifically they want more detail on. A repeated question is a signal to add something new, never to reprint the same facts in the same order.
- Vary your opening sentence and closing sentence across turns — do not reuse the same phrasing pattern (e.g. "Your financial profile shows...", "Consider allocating your excess cash flow towards...") in consecutive responses, even when answering a similar question. Restate the underlying facts, not the same sentence structure.
- Actively drive the conversation forward: end nearly every response with one short, specific, genuinely optional next step or question tied to what the user just asked (e.g. naming a specific category to dig into, offering to run a scenario, offering to compare against last month). Make the question different each time — do not reuse the same closing question across turns. Skip the closing question only for a simple factual lookup with a complete, closed answer (e.g. "what's my current risk score").
- Prefer short paragraphs or a tight bulleted list over long dense paragraphs.
Answer directly and concisely. Do not narrate your reasoning process, do not restate the question, and do not repeat the same conclusion in different words within a single response.`;

export const runScenarioSimulationTool = createTool({
  id: 'runScenarioSimulation',
  description:
    'Run a 12/24/36 month financial scenario projection for hypothetical or decision questions, such as vehicle purchases, new loans, investment changes, salary changes, savings increases, or early loan repayment. If inputs are missing, the tool uses the user actual current profile and loan/debt data.',
  inputSchema: scenarioToolInputSchema,
  requestContextSchema: toolRequestContextSchema,
  execute: async (input, context) => {
    return runScenarioSimulation(
      getToolUserId(context),
      input.scenarioType,
      normalizeScenarioParameters(input.scenarioType, input.params),
    );
  },
});

export const getFreshRecommendationTool = createTool({
  id: 'getFreshRecommendation',
  description:
    'Generate fresh personalized financial recommendations when the user asks an open-ended improvement question that is not already answered well by stored recommendations.',
  inputSchema: z.object({
    question: z.string().optional(),
  }),
  requestContextSchema: toolRequestContextSchema,
  execute: async (input, context) => {
    return getFreshRecommendation(getToolUserId(context), input.question);
  },
});

export const getCurrentRiskProfileTool = createTool({
  id: 'getCurrentRiskProfile',
  description:
    'Read the authenticated user current financial profile and latest risk score from the database.',
  inputSchema: z.object({
    reason: z.string().optional().describe('Optional brief note on why this data is needed'),
  }),
  requestContextSchema: toolRequestContextSchema,
  execute: async (_input, context) => {
    return getCurrentRiskProfile(getToolUserId(context));
  },
});

const RATIO_METRICS = [
  'savingsToAnnualIncomeRatio',
  'expenseToIncomeRatio',
  'monthsOfExpensesCovered',
  'netWorthToAnnualIncomeRatio',
  'categoryShareOfExpenses',
] as const;

type RatioMetric = (typeof RATIO_METRICS)[number];
type RatioInput =
  | {
      metric:
        | 'savingsToAnnualIncomeRatio'
        | 'expenseToIncomeRatio'
        | 'monthsOfExpensesCovered'
        | 'netWorthToAnnualIncomeRatio';
    }
  | {
      metric: 'categoryShareOfExpenses';
      category: string;
    };

type RatioResult =
  | {
      metric: RatioMetric;
      available: true;
      value: number;
      unit: '%' | 'months';
      inputsUsed: Record<string, number>;
      currencySymbol: string;
    }
  | {
      metric: RatioMetric;
      available: false;
      reason: string;
      currencySymbol: string;
    };

function roundTo(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export const computeFinancialRatioTool = createTool({
  id: 'computeFinancialRatio',
  description:
    'Compute an exact financial ratio or percentage (e.g. savings as a % of annual income, expense-to-income ratio, months of expenses covered by savings) using real arithmetic on the verified profile. ALWAYS use this tool for any derived percentage/ratio/comparison the user asks for — never calculate it yourself, even if the raw numbers are already visible in Context. Returns available: false with a reason if a required input is missing, rather than guessing.',
  inputSchema: z
    .discriminatedUnion('metric', [
      z.object({
        metric: z
          .literal('savingsToAnnualIncomeRatio')
          .describe('savings / (monthlyIncome * 12) * 100.'),
      }),
      z.object({
        metric: z
          .literal('expenseToIncomeRatio')
          .describe('monthlyExpenses / monthlyIncome * 100.'),
      }),
      z.object({
        metric: z
          .literal('monthsOfExpensesCovered')
          .describe('savings / monthlyExpenses.'),
      }),
      z.object({
        metric: z
          .literal('netWorthToAnnualIncomeRatio')
          .describe('netWorth / (monthlyIncome * 12) * 100.'),
      }),
      z.object({
        metric: z
          .literal('categoryShareOfExpenses')
          .describe(
            'A single expense category amount as a % of total monthlyExpenses.',
          ),
        category: z
          .string()
          .describe(
            'Required for categoryShareOfExpenses — must match a category name from the financial profile categories list.',
          ),
      }),
    ])
    .describe(
      'Pick exactly one ratio metric. Only include category when metric is categoryShareOfExpenses.',
    ),
  requestContextSchema: toolRequestContextSchema,
  execute: async (input: RatioInput, context): Promise<RatioResult> => {
    const { financialProfile, currencySymbol } = await getCurrentRiskProfile(
      getToolUserId(context),
    );

    const monthlyIncome = financialProfile?.['monthly_income'] as
      | number
      | null
      | undefined;
    const monthlyExpenses = financialProfile?.['monthly_expenses'] as
      | number
      | null
      | undefined;
    const savings = financialProfile?.['savings'] as number | null | undefined;
    const netWorth = financialProfile?.['net_worth'] as
      | number
      | null
      | undefined;

    const missing = (fields: string[]): RatioResult => ({
      metric: input.metric,
      available: false,
      reason: `Cannot compute ${input.metric}: missing ${fields.join(', ')} from the verified profile.`,
      currencySymbol,
    });

    switch (input.metric) {
      case 'savingsToAnnualIncomeRatio': {
        if (savings == null || monthlyIncome == null) {
          return missing(['savings', 'monthlyIncome']);
        }
        const annualIncome = monthlyIncome * 12;
        if (annualIncome === 0) return missing(['monthlyIncome (zero)']);
        return {
          metric: input.metric,
          available: true,
          value: roundTo((savings / annualIncome) * 100),
          unit: '%',
          inputsUsed: { savings, monthlyIncome, annualIncome },
          currencySymbol,
        };
      }
      case 'expenseToIncomeRatio': {
        if (monthlyExpenses == null || monthlyIncome == null) {
          return missing(['monthlyExpenses', 'monthlyIncome']);
        }
        if (monthlyIncome === 0) return missing(['monthlyIncome (zero)']);
        return {
          metric: input.metric,
          available: true,
          value: roundTo((monthlyExpenses / monthlyIncome) * 100),
          unit: '%',
          inputsUsed: { monthlyExpenses, monthlyIncome },
          currencySymbol,
        };
      }
      case 'monthsOfExpensesCovered': {
        if (savings == null || monthlyExpenses == null) {
          return missing(['savings', 'monthlyExpenses']);
        }
        if (monthlyExpenses === 0) return missing(['monthlyExpenses (zero)']);
        return {
          metric: input.metric,
          available: true,
          value: roundTo(savings / monthlyExpenses),
          unit: 'months',
          inputsUsed: { savings, monthlyExpenses },
          currencySymbol,
        };
      }
      case 'netWorthToAnnualIncomeRatio': {
        if (netWorth == null || monthlyIncome == null) {
          return missing(['netWorth', 'monthlyIncome']);
        }
        const annualIncome = monthlyIncome * 12;
        if (annualIncome === 0) return missing(['monthlyIncome (zero)']);
        return {
          metric: input.metric,
          available: true,
          value: roundTo((netWorth / annualIncome) * 100),
          unit: '%',
          inputsUsed: { netWorth, monthlyIncome, annualIncome },
          currencySymbol,
        };
      }
      case 'categoryShareOfExpenses': {
        if (!input.category) {
          return missing(['category (required for this metric)']);
        }
        if (monthlyExpenses == null || monthlyExpenses === 0) {
          return missing(['monthlyExpenses']);
        }
        const categories =
          (financialProfile?.['categories'] as
            | { category: string; amount: number }[]
            | null) ?? [];
        const match = categories.find(
          (category) =>
            category.category?.toLowerCase() === input.category?.toLowerCase(),
        );
        if (!match) {
          return missing([
            `category "${input.category}" not found in profile categories`,
          ]);
        }
        return {
          metric: input.metric,
          available: true,
          value: roundTo((match.amount / monthlyExpenses) * 100),
          unit: '%',
          inputsUsed: { categoryAmount: match.amount, monthlyExpenses },
          currencySymbol,
        };
      }
    }
  },
});

export const assistantAgent = new Agent({
  id: 'assistantAgent',
  name: 'Financial Assistant Agent',
  instructions: ASSISTANT_AGENT_INSTRUCTIONS,
  model: GROQ_CHAT_MODEL,
  tools: {
    runScenarioSimulation: runScenarioSimulationTool,
    getFreshRecommendation: getFreshRecommendationTool,
    getCurrentRiskProfile: getCurrentRiskProfileTool,
    computeFinancialRatio: computeFinancialRatioTool,
  },
});

function getErrorField(error: unknown, field: string): unknown {
  return error && typeof error === 'object'
    ? (error as Record<string, unknown>)[field]
    : undefined;
}

function getErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const responseBody = getErrorField(error, 'responseBody');
  const code = getErrorField(error, 'code');
  return [
    message,
    typeof responseBody === 'string' ? responseBody : '',
    typeof code === 'string' ? code : '',
  ].join('\n');
}

function isToolCallValidationError(error: unknown): boolean {
  const message = getErrorText(error);
  return (
    message.includes('tool call validation failed')
    && (
      message.includes('attempted to call tool')
      || message.includes('which was not in request.tools')
      || message.includes('parameters for tool')
    )
  );
}

function isToolUseGenerationError(error: unknown): boolean {
  const message = getErrorText(error);
  const statusCode = getErrorField(error, 'statusCode');
  return (
    isToolCallValidationError(error)
    || message.includes('tool_use_failed')
    || message.includes('failed_generation')
    || message.includes('Failed to call a function')
    || statusCode === 400 && message.includes('<function=')
  );
}

export async function answerAssistantQuestionWithLLM(
  prompt: string,
  requestContext: RequestContext<{ userId: string }>,
): Promise<string> {
  try {
    await acquireGroqTokens(estimateTokens(prompt) + GROQ_TOOL_LOOP_TOKEN_BUDGET);

    let response;
    try {
      response = await assistantAgent.generate(prompt, {
        requestContext,
        modelSettings: { temperature: 0.2 },
      });
    } catch (error) {
      if (!isToolUseGenerationError(error)) {
        throw error;
      }

      console.warn(
        'Retrying assistantAgent after tool-call generation failure:',
        error,
      );
      try {
        response = await assistantAgent.generate(
          [
            prompt,
            'Tool-call correction:',
            'Your previous tool call was invalid. If you call a tool, set the tool name to exactly one of runScenarioSimulation, getFreshRecommendation, getCurrentRiskProfile, or computeFinancialRatio. Put arguments only in the arguments object. Tool arguments must be strict JSON with literal values only: no arithmetic expressions, formulas, comments, or derived calculations inside arguments. For runScenarioSimulation, include params with all 11 keys; use numbers for the relevant fields and null for every unused field. For runScenarioSimulation increase_savings, pass savingsIncreasePercent as a literal percent like 60, or savingsIncrease as a literal amount. For computeFinancialRatio, include only metric for savingsToAnnualIncomeRatio, expenseToIncomeRatio, monthsOfExpensesCovered, and netWorthToAnnualIncomeRatio. Include category only when metric is categoryShareOfExpenses. If you cannot make a valid tool call, answer with a brief clarification question instead of calling a tool.',
          ].join('\n\n'),
          {
            requestContext,
            modelSettings: { temperature: 0 },
          },
        );
      } catch (retryError) {
        if (!isToolUseGenerationError(retryError)) {
          throw retryError;
        }

        console.warn('assistantAgent retry also failed tool-call generation:', retryError);
        return 'I could not run that scenario because the tool call was not valid. Please tell me the scenario and one concrete number, such as the amount to save more each month or the percentage increase.';
      }
    }

    const text = response.text?.trim();
    if (!text) {
      throw new Error('assistantAgent returned an empty response');
    }
    return text;
  } catch (error) {
    console.error('assistantAgent step failed:', error);
    throw error;
  }
}
