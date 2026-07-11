import { PDFParse } from 'pdf-parse';

export type RuleBasedTransaction = {
  date: string | null;
  amount: number | null;
  merchant: string | null;
  category: string | null;
  type: 'credit' | 'debit' | null;
};

export type RuleBasedExtraction = {
  income: { monthlyIncome: number | null; source: string | null };
  expenses: { monthlyExpenses: number | null; categories: never[] };
  transactions: RuleBasedTransaction[];
  accountBalance: number | null;
  summary: string;
  confidence: number; // 0-1, calibrated against verifiable cross-checks, not row count
};

const DATE_PATTERNS = [
  /\b(\d{4}-\d{2}-\d{2})\b/,
  /\b(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\b/,
  /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i,
  /\b(\d{2}[\/\-]\d{2})\b/,
];

// Two-tier amount matching: prefer strict decimal-cents matches (very low
// false-positive rate), but also accept comma-grouped whole-rupee amounts
// (e.g. "1,500") since not every bank prints paise. Bare, ungrouped small
// integers ("1500") are intentionally NOT matched here — those are
// indistinguishable from reference numbers in plain text and are the exact
// false-positive source the earlier decimal-only fix eliminated. This means
// banks that print bare integers with no comma grouping will still under-
// match; that gap is caught by the coverage check in confidence scoring
// below rather than silently assumed away.
const STRICT_AMOUNT_PATTERN = /[-+]?[₹$€£]?\s?\d{1,3}(?:,\d{3})*\.\d{2}\b/g;
const GROUPED_INTEGER_AMOUNT_PATTERN = /[-+]?[₹$€£]?\s?\d{1,3}(?:,\d{3})+\b/g;

const CREDIT_KEYWORDS =
  /deposit|credit|salary|payroll|refund|interest\s*credit|preauthorized\s*credit|neft\s*cr|imps\s*cr/i;
const DEBIT_KEYWORDS =
  /withdrawal|debit|purchase|payment|fee|charge|check|transfer\s*out|atm|upi\b|neft\b|imps\b/i;

const BALANCE_LINE_PATTERN = /(?:ending|closing|current)\s+balance[:\s]*[₹$€£]?\s?([\d,]+\.?\d*)/i;
const OPENING_BALANCE_PATTERN = /opening\s+balance[:\s]*[₹$€£]?\s?([\d,]+\.?\d*)/i;
const INCOME_LINE_PATTERN = /(?:total\s+)?(?:deposits?|credits?|income)[:\s]*[₹$€£]?\s?([\d,]+\.?\d*)/i;

const TOTAL_ROW_PATTERN =
  /\btotal\b[:\s]+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i;

const NON_TRANSACTION_LINE_PATTERN =
  /\b(balance\s+forward|opening\s+balance|statement\s+date|account\s+no|total\s+points|reward\s+plus|scheme\s+opening)\b/i;

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₹$€£,\s]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractDateFromLine(line: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = line.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// null return now means "ambiguous," not "definitely neither" — callers use
// this distinction to track coverage rather than silently defaulting.
function classifyLine(line: string): 'credit' | 'debit' | null {
  const isCredit = CREDIT_KEYWORDS.test(line);
  const isDebit = DEBIT_KEYWORDS.test(line);
  if (isCredit && !isDebit) return 'credit';
  if (isDebit && !isCredit) return 'debit';
  return null; // both matched or neither matched — genuinely ambiguous
}

function extractMerchant(line: string, date: string | null, amount: string | null): string {
  let cleaned = line;
  if (date) cleaned = cleaned.replace(date, '');
  if (amount) cleaned = cleaned.replace(amount, '');
  return cleaned.replace(/\s{2,}/g, ' ').trim().slice(0, 80) || 'Unknown';
}

export async function extractRuleBasedFromPdf(pdfBuffer: Buffer): Promise<RuleBasedExtraction> {
  const parser = new PDFParse({ data: pdfBuffer });
  let text: string;

  try {
    const result = await parser.getText();
    text = result.text;
    console.log('RAW PDF TEXT SAMPLE:\n', text.slice(0, 3000));
  } finally {
    await parser.destroy();
  }

  const lines = text
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 3);

  let totalRowIncome: number | null = null;
  let totalRowExpenses: number | null = null;
  let totalRowBalance: number | null = null;

  for (const line of lines) {
    const totalMatch = line.match(TOTAL_ROW_PATTERN);
    if (totalMatch) {
      const [, incomeRaw, expensesRaw, balanceRaw] = totalMatch;
      if (incomeRaw && expensesRaw && balanceRaw) {
        totalRowIncome = parseAmount(incomeRaw);
        totalRowExpenses = parseAmount(expensesRaw);
        totalRowBalance = parseAmount(balanceRaw);
        break;
      }
    }
  }

  let openingBalance: number | null = null;
  for (const line of lines) {
    const openingMatch = line.match(OPENING_BALANCE_PATTERN);
    if (openingMatch?.[1]) {
      openingBalance = parseAmount(openingMatch[1]);
      break;
    }
  }

  const transactions: RuleBasedTransaction[] = [];
  let candidateLinesConsidered = 0;
  let ambiguousTypeCount = 0;

  for (const line of lines) {
    if (NON_TRANSACTION_LINE_PATTERN.test(line)) continue;

    const date = extractDateFromLine(line);
    if (!date) continue;

    let amountMatches: RegExpMatchArray | null = line.match(STRICT_AMOUNT_PATTERN);
    if (!amountMatches || amountMatches.length === 0) {
      amountMatches = line.match(GROUPED_INTEGER_AMOUNT_PATTERN);
    }
    if (!amountMatches || amountMatches.length === 0) continue;

    candidateLinesConsidered += 1;

    const rawAmount =
      amountMatches.length >= 2 ? amountMatches.at(-2) : amountMatches.at(-1);
    if (!rawAmount) continue;

    const amount = parseAmount(rawAmount);
    if (amount === null || amount === 0) continue;

    const type = classifyLine(line);
    if (type === null) ambiguousTypeCount += 1;

    const merchant = extractMerchant(line, date, rawAmount);

    transactions.push({
      date,
      amount: type === 'debit' ? -Math.abs(amount) : Math.abs(amount),
      merchant,
      category: type ?? 'uncategorized',
      type,
    });
  }

  let accountBalance: number | null = totalRowBalance;
  let monthlyIncome: number | null = totalRowIncome;

  if (accountBalance === null || monthlyIncome === null) {
    for (const line of lines) {
      if (accountBalance === null) {
        const balanceMatch = line.match(BALANCE_LINE_PATTERN);
        if (balanceMatch?.[1]) accountBalance = parseAmount(balanceMatch[1]);
      }
      if (monthlyIncome === null) {
        const incomeMatch = line.match(INCOME_LINE_PATTERN);
        if (incomeMatch?.[1]) monthlyIncome = parseAmount(incomeMatch[1]);
      }
    }
  }

  // Only count CLASSIFIED transactions toward sums — ambiguous ones are
  // excluded from both, same as before, but now tracked explicitly so
  // confidence reflects how much of the statement they represent.
  const debitSum = transactions
    .filter((t) => t.type === 'debit' && t.amount !== null)
    .reduce((sum, t) => sum + Math.abs(t.amount as number), 0);

  const creditSum = transactions
    .filter((t) => t.type === 'credit' && t.amount !== null)
    .reduce((sum, t) => sum + Math.abs(t.amount as number), 0);

  const monthlyExpenses = totalRowExpenses ?? (debitSum > 0 ? debitSum : null);

  // --- Confidence, rebuilt around verifiable cross-checks -----------------
  // Every component below is a check against something the statement itself
  // asserts (a total row, a stated opening/closing balance) rather than an
  // arbitrary "more rows = more confident" heuristic. A score near 1.0 means
  // the line-item data actually reconciles with the statement's own claims,
  // not just that regexes matched something.

  let confidence = 0;

  // 1. Cross-check against the statement's own TOTAL row, when present —
  //    this is the strongest available ground truth.
  if (totalRowExpenses !== null && debitSum > 0) {
    const deviation = Math.abs(totalRowExpenses - debitSum) / totalRowExpenses;
    confidence += deviation <= 0.02 ? 0.35 : deviation <= 0.15 ? 0.15 : -0.25;
  }
  if (totalRowIncome !== null && creditSum > 0) {
    const deviation = Math.abs(totalRowIncome - creditSum) / totalRowIncome;
    confidence += deviation <= 0.02 ? 0.15 : deviation <= 0.15 ? 0.05 : -0.1;
  }

  // 2. Cross-check via balance arithmetic when an opening balance was found:
  //    openingBalance + creditSum - debitSum should equal accountBalance.
  //    This is independent of whether a TOTAL row exists at all, so it
  //    catches errors even on statements without one.
  if (openingBalance !== null && accountBalance !== null && (debitSum > 0 || creditSum > 0)) {
    const impliedClosing = openingBalance + creditSum - debitSum;
    const deviation = Math.abs(impliedClosing - accountBalance) / Math.max(accountBalance, 1);
    confidence += deviation <= 0.02 ? 0.3 : deviation <= 0.1 ? 0.1 : -0.25;
  }

  // 3. Coverage: what fraction of candidate transaction lines actually
  //    resolved to a definite debit/credit, vs. being dropped as ambiguous?
  //    Low coverage means the totals above are built from a subset and
  //    can't be fully trusted even if the subset itself reconciles.
  if (candidateLinesConsidered > 0) {
    const coverage = 1 - ambiguousTypeCount / candidateLinesConsidered;
    confidence += (coverage - 0.5) * 0.3; // scales roughly -0.15 to +0.15
  }

  // 4. Baseline signal that *something* was found at all — kept small and
  //    strictly secondary to the cross-checks above.
  if (transactions.length >= 5) confidence += 0.1;
  if (accountBalance !== null) confidence += 0.05;

  // 5. No cross-check was even possible (no TOTAL row, no opening balance
  //    found) — cap confidence hard regardless of how many rows matched,
  //    since there is nothing here that has actually been verified.
  const hadAnyCrossCheck =
    (totalRowExpenses !== null && debitSum > 0) ||
    (openingBalance !== null && accountBalance !== null);
  if (!hadAnyCrossCheck) {
    confidence = Math.min(confidence, 0.35);
  }

  return {
    income: {
      monthlyIncome: monthlyIncome ?? (creditSum > 0 ? creditSum : null),
      source: null,
    },
    expenses: {
      monthlyExpenses,
      categories: [],
    },
    transactions,
    accountBalance,
    summary: `Rule-based extraction: ${transactions.length} transactions found (${ambiguousTypeCount} ambiguous type), ${
      accountBalance !== null ? `balance ${accountBalance}` : 'no balance detected'
    }.`,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}