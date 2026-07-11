import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { parseStrictJsonFromLLM } from '../lib/llm.js';
import {
  GeminiMalformedJsonError,
  generateJsonFromPdf,
} from '../lib/gemini-document.js';
import { GROQ_CHAT_MODEL } from '../lib/models.js';
import { extractRuleBasedFromPdf } from '../lib/rule-based-extractor.js';
import { extractDebtFromPdf } from '../lib/rule-based-debt-extractor.js';


const RULE_BASED_CONFIDENCE_THRESHOLD = 0.75;       // existing, bank statements
const RULE_BASED_DEBT_CONFIDENCE_THRESHOLD = 0.8;    // NEW, loan/credit-card statements
const transactionSchema = z.object({
  date: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  balanceAfter: z.number().nullable().optional(), // running balance after this transaction, if visible
});

export const financialProfileExtractionSchema = z.object({
  income: z
    .object({
      currency: z.string().nullable().optional(),
      monthlyIncome: z.number().nullable().optional(), // ignored — recomputed in code
      source: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  expenses: z
    .object({
      monthlyExpenses: z.number().nullable().optional(), // ignored — recomputed in code
      categories: z.array(z.object({ category: z.string(), amount: z.number() })).optional(), // ignored — recomputed in code
    })
    .nullable()
    .optional(),
  transactions: z.preprocess(
    (value) => (value === null || value === undefined ? [] : value),
    z.array(transactionSchema),
  ),
  accountBalance: z.number().nullable().optional(),
  openingBalance: z.number().nullable().optional(), // NEW — balance before the first transaction
  debt: z
    .object({
      totalOutstandingDebt: z.number().nullable().optional(),
      monthlyDebtPayment: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  summary: z.preprocess((value) => (value == null ? '' : value), z.string()),
});

export type FinancialProfileExtraction = z.infer<typeof financialProfileExtractionSchema>;

export const FINANCIAL_PROFILE_AGENT_INSTRUCTIONS = `You are a financial data extraction specialist. Read the provided PDF document and extract structured financial information. Return ONLY valid JSON with no markdown fences or commentary. Use null when a value is not present, and keep the summary concise.`;

const GEMINI_EXTRACTION_PROMPT = `Extract financial information from the attached PDF document.

IMPORTANT: Bank and loan statements often show the same totals in multiple places — 
for example, an "Account Summary" section and a separate itemized detail table 
(e.g. "Checks Paid" appearing both as a summary line and as a detailed table with 
its own total). Do NOT add these together. Use the itemized/detailed transaction 
tables as the source of truth, and compute monthlyExpenses and monthlyIncome by 
summing the actual transaction line items you extract into the "transactions" 
array below — do not copy a summary-section total directly if it conflicts with 
the itemized transactions.

You MUST populate the "transactions" array with every individual transaction line 
item found in the document (deposits, withdrawals, checks paid, ATM withdrawals, 
fees, etc.), even if the document also provides its own summary totals. Never 
return an empty transactions array if the document contains itemized transaction 
tables.

Rules:
- Transcribe EVERY individual transaction line item exactly as printed: date, amount, merchant/description, a short category label, and the running "balanceAfter" shown in the balance column for that row (if the statement shows one).
- Do NOT determine whether a transaction is a credit or debit. Do NOT include a "type" field — leave it out entirely. Direction will be computed from balance changes, not from your judgment.
- Do NOT calculate or state total monthly income or total monthly expenses. Leave "income.monthlyIncome" and "expenses.monthlyExpenses" as null. Do NOT compute category totals — leave "expenses.categories" as an empty array. All totals are computed programmatically from your transaction transcriptions, never from your own summation.
- Extract "openingBalance": the account balance immediately BEFORE the first transaction in the statement (often shown as "Opening Balance" or derivable as the first transaction's balanceAfter minus its own amount, if stated).
- Extract "accountBalance": the final closing balance shown at the end of the statement.
- Extract amounts as the absolute (unsigned) value printed — do not infer sign.

Return ONLY valid JSON matching this exact shape:
{
  "income": { "currency": string | null, "monthlyIncome": null, "source": string | null },
  "expenses": { "monthlyExpenses": null, "categories": [] },
  "transactions": [
    {
      "date": string,
      "amount": number,
      "merchant": string,
      "category": string,
      "balanceAfter": number | null
    }
  ],
  "accountBalance": number | null,
  "openingBalance": number | null,
  "debt": { "totalOutstandingDebt": number | null, "monthlyDebtPayment": number | null },
  "summary": string
}

If this document is a loan or credit card statement, also extract "debt.totalOutstandingDebt" and "debt.monthlyDebtPayment" (both null for bank statements/salary slips).
Extract the currency code (INR, USD, EUR) from context or symbols (₹, $, €).

Use null for missing scalar values. Return an empty array for transactions only 
if the document truly contains no transaction line items.
Extract the currency code (e.g. INR, USD, EUR) shown on the statement, typically near account details or transaction amounts. If not explicitly labeled, infer from currency symbols (₹, $, €) used in the document.
If this document is a loan statement or credit card statement, also extract "debt.totalOutstandingDebt" (current outstanding principal/balance owed) and "debt.monthlyDebtPayment" (the minimum or scheduled monthly payment amount). 
Use null for both if this is a bank statement, salary slip, or other document type that doesn't state these figures — do not guess or estimate them.
If the statement shows a running balance column, extract "balanceAfter" for each 
transaction — the account balance immediately after that transaction posted. This 
is used to verify credit/debit direction, so prioritize reading it accurately even 
on lower-quality scans, and use it (rather than visual cues like column position 
alone) to determine whether each transaction is a credit or debit — balance 
increasing means credit, balance decreasing means debit.`;

export const financialProfileAgent = new Agent({
  id: 'financialProfileAgent',
  name: 'Financial Profile Agent',
  instructions: FINANCIAL_PROFILE_AGENT_INSTRUCTIONS,
  model: GROQ_CHAT_MODEL,
});

function normalizeFinancialProfilePayload(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return payload;
  }

  const normalized: Record<string, unknown> = {
    ...(payload as Record<string, unknown>),
  };

  if (normalized['transactions'] === null || normalized['transactions'] === undefined) {
    normalized['transactions'] = [];
  }

  if (normalized['summary'] === null || normalized['summary'] === undefined) {
    normalized['summary'] = '';
  }

  return normalized;
}

type DerivedTransaction = FinancialProfileExtraction['transactions'][number] & {
  derivedType: 'credit' | 'debit';
  typeConfidence: 'balance-derived' | 'assumed-debit';
};

function deriveTransactionsFromBalances(
  transactions: FinancialProfileExtraction['transactions'],
  openingBalance: number | null,
): DerivedTransaction[] {
  let priorBalance = openingBalance;

  return transactions.map((t) => {
    if (priorBalance != null && t.balanceAfter != null) {
      const delta = t.balanceAfter - priorBalance;
      priorBalance = t.balanceAfter;
      return {
        ...t,
        derivedType: delta >= 0 ? 'credit' : 'debit',
        typeConfidence: 'balance-derived',
      };
    }

    // No usable balance chain for this row — cannot verify direction.
    // Conservative default (matches prior behavior), but explicitly flagged
    // as unverified rather than silently trusted.
    if (t.balanceAfter != null) priorBalance = t.balanceAfter;
    return { ...t, derivedType: 'debit', typeConfidence: 'assumed-debit' };
  });
}

function computeAggregatesFromTransactions(transactions: DerivedTransaction[]) {
  const monthlyIncome = transactions
    .filter((t) => t.derivedType === 'credit' && t.amount != null)
    .reduce((sum, t) => sum + Math.abs(t.amount as number), 0);

  const monthlyExpenses = transactions
    .filter((t) => t.derivedType === 'debit' && t.amount != null)
    .reduce((sum, t) => sum + Math.abs(t.amount as number), 0);

  const categoryTotals = new Map<string, number>();
  for (const t of transactions) {
    if (t.derivedType !== 'debit' || t.amount == null) continue;
    const key = t.category?.trim() || 'Other';
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Math.abs(t.amount));
  }
  const categories = Array.from(categoryTotals.entries()).map(([category, amount]) => ({
    category,
    amount: Math.round(amount * 100) / 100,
  }));

  const unverifiedCount = transactions.filter((t) => t.typeConfidence === 'assumed-debit').length;

  return { monthlyIncome, monthlyExpenses, categories, unverifiedCount, total: transactions.length };
}

export function validateFinancialProfileExtraction(payload: unknown): FinancialProfileExtraction {
  const normalized = normalizeFinancialProfilePayload(payload);
  const result = financialProfileExtractionSchema.safeParse(normalized);
  if (!result.success) {
    throw new Error(`Financial profile extraction failed schema validation: ${result.error.message}`);
  }

  const extraction = result.data;

  const derived = deriveTransactionsFromBalances(extraction.transactions, extraction.openingBalance ?? null);
  const { monthlyIncome, monthlyExpenses, categories, unverifiedCount, total } =
    computeAggregatesFromTransactions(derived);

  if (unverifiedCount > 0) {
    console.warn(
      `${unverifiedCount}/${total} transactions had no usable balance chain; ` +
      `direction defaulted to debit and is unverified for those rows.`,
    );
  }

  extraction.transactions = derived.map(({ derivedType, typeConfidence, ...t }) => ({
    ...t,
    type: derivedType,
  }));
  extraction.income = { ...extraction.income, monthlyIncome };
  extraction.expenses = { ...extraction.expenses, monthlyExpenses, categories };

  return extraction;
}

export async function extractFinancialProfileFromPdf(
  pdfBuffer: Buffer,
  docType?: string, // NEW — pass this through from the upload/intake route
): Promise<FinancialProfileExtraction> {
  const normalizedDocType = docType?.toLowerCase();
  const isDebtDocument =
    normalizedDocType === 'loan_statement' || normalizedDocType === 'credit_card_statement';

  // --- Fast path A: debt documents (loan / credit card statements) ---
  if (isDebtDocument) {
    try {
      const debtResult = await extractDebtFromPdf(pdfBuffer);

      console.log(
        `Rule-based debt extraction confidence: ${debtResult.confidence.toFixed(2)} ` +
          `(guessed type: ${debtResult.documentTypeGuess}, ` +
          `outstanding=${debtResult.debt.totalOutstandingDebt ?? 'none'}, ` +
          `monthlyPayment=${debtResult.debt.monthlyDebtPayment ?? 'none'})`,
      );

      if (debtResult.confidence >= RULE_BASED_DEBT_CONFIDENCE_THRESHOLD) {
        console.log('Using rule-based debt extraction (Gemini skipped — no LLM cost incurred).');
        return validateFinancialProfileExtraction({
          income: { currency: null, monthlyIncome: null, source: null },
          expenses: { monthlyExpenses: null, categories: [] },
          transactions: [],
          accountBalance: null,
          openingBalance: null,
          debt: debtResult.debt,
          summary: debtResult.summary,
        });
      }

      console.log(
        `Rule-based debt confidence too low (${debtResult.confidence.toFixed(2)} < ` +
          `${RULE_BASED_DEBT_CONFIDENCE_THRESHOLD}); falling back to Gemini extraction.`,
      );
    } catch (error) {
      console.warn('Rule-based debt extraction failed; falling back to Gemini extraction:', error);
    }
  }

  // --- Fast path B: bank statements (existing, unchanged) ---
  if (!isDebtDocument) {
    try {
      const ruleBased = await extractRuleBasedFromPdf(pdfBuffer);

      console.log(
        `Rule-based extraction confidence: ${ruleBased.confidence.toFixed(2)} ` +
          `(${ruleBased.transactions.length} transactions, ` +
          `balance=${ruleBased.accountBalance ?? 'none'})`,
      );

      if (ruleBased.confidence >= RULE_BASED_CONFIDENCE_THRESHOLD) {
        console.log('Using rule-based extraction (Gemini skipped — no LLM cost incurred).');
        return validateFinancialProfileExtraction({
          income: ruleBased.income,
          expenses: ruleBased.expenses,
          transactions: ruleBased.transactions,
          accountBalance: ruleBased.accountBalance,
          summary: ruleBased.summary,
        });
      }

      console.log(
        `Rule-based confidence too low (${ruleBased.confidence.toFixed(2)} < ` +
          `${RULE_BASED_CONFIDENCE_THRESHOLD}); falling back to Gemini extraction.`,
      );
    } catch (error) {
      console.warn('Rule-based extraction failed; falling back to Gemini extraction:', error);
    }
  }

  // --- Fallback path: existing Gemini-based extraction (unchanged) ---
  try {
    const raw = await generateJsonFromPdf(
      pdfBuffer,
      GEMINI_EXTRACTION_PROMPT,
      FINANCIAL_PROFILE_AGENT_INSTRUCTIONS,
    );

    let parsed: unknown;
    try {
      parsed = parseStrictJsonFromLLM(raw);
    } catch {
      throw new GeminiMalformedJsonError('Gemini returned malformed JSON for financial profile extraction');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new GeminiMalformedJsonError('Gemini returned malformed JSON for financial profile extraction');
    }

    return validateFinancialProfileExtraction(parsed);
  } catch (error) {
    console.error('financialProfileAgent step failed:', error);
    throw error;
  }
}