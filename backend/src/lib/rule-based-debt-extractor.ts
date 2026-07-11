import { PDFParse } from 'pdf-parse';

export type DebtDocumentTypeGuess = 'loan_statement' | 'credit_card_statement' | 'unknown';

export type RuleBasedDebtExtraction = {
  debt: {
    totalOutstandingDebt: number | null;
    monthlyDebtPayment: number | null;
  };
  documentTypeGuess: DebtDocumentTypeGuess;
  summary: string;
  confidence: number; // 0-1, calibrated against verifiable cross-checks, same philosophy as extractRuleBasedFromPdf
};

// --- Amount matching -------------------------------------------------------
// Same two-tier strategy as the bank-statement extractor: prefer strict
// decimal-cents amounts, fall back to comma-grouped whole-currency amounts.
// Bare ungrouped integers are intentionally not matched (indistinguishable
// from account/reference numbers in plain text).

function amountPattern(label: RegExp): RegExp {
  // Lazy, unbounded gap: real statements put parenthetical clarifications
  // ("Total Amount Due (Outstanding Balance)") and wide table whitespace
  // between the label and the figure, so a tight [:\s]* connector misses
  // most real matches. Lazy quantifier still finds the *nearest* number,
  // it just isn't fooled by intervening non-digit text.
  return new RegExp(
    label.source + String.raw`[^\d\n]*?[₹$€£]?\s?([\d,]+(?:\.\d{2})?)`,
    label.flags.includes('i') ? 'i' : label.flags + 'i',
  );
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₹$€£,\s]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

// --- Field label patterns, ordered by specificity within each category ----
// Order matters: earlier patterns win when multiple distinct values are
// found and none of them cross-validate against each other.

// Negative lookbehinds prevent "Minimum Amount Due" / "Min. Amount Due" lines
// (which contain the literal substring "amount due") from being misread as
// the TOTAL outstanding figure — these must stay disjoint from
// MONTHLY_PAYMENT_LABELS below or the two fields silently collide.
const TOTAL_OUTSTANDING_LABELS: RegExp[] = [
  /outstanding\s+principal(?:\s+balance)?/i,
  /principal\s+outstanding/i,
  /total\s+outstanding\s+(?:balance|debt|amount)/i,
  /(?<!minimum\s)(?<!min\.?\s)(?:total\s+)?amount\s+due/i,
  /current\s+outstanding\s+balance/i,
  /(?<!minimum\s)(?<!min\.?\s)outstanding\s+balance/i,
  /closing\s+balance/i, // credit-card statements sometimes use this for total due
];

const MONTHLY_PAYMENT_LABELS: RegExp[] = [
  /equated\s+monthly\s+installment/i,
  /monthly\s+emi/i,
  /\bemi\b/i,
  /monthly\s+installment/i,
  /minimum\s+amount\s+due/i,
  /min\.?\s+amount\s+due/i,
  /minimum\s+payment\s+due/i,
];

const CREDIT_LIMIT_LABEL = /credit\s+limit/i;
const AVAILABLE_CREDIT_LABEL = /available\s+credit(?:\s+limit)?/i;
const PREVIOUS_BALANCE_LABEL = /previous\s+balance/i;
const PAYMENTS_RECEIVED_LABEL = /payments?\s+received/i;
const NEW_CHARGES_LABEL = /new\s+(?:purchases|charges)/i;

const LOAN_KEYWORDS =
  /\bloan\s+account\b|\bsanctioned\s+amount\b|\bhome\s+loan\b|\bpersonal\s+loan\b|\bvehicle\s+loan\b|\bemi\b|\btenure\b|\bdisburs/i;
const CREDIT_CARD_KEYWORDS =
  /\bcredit\s+card\b|\bminimum\s+amount\s+due\b|\bcard\s+number\b|\bstatement\s+period\b|\bfinance\s+charges?\b/i;

// Itemized transaction / payment-history rows start with a date and often
// contain incidental keyword matches (e.g. "EMI Payment - Auto Debit" rows
// contain "EMI" but are not the summary EMI figure, and can carry three
// amounts — principal, interest, total — on one line). These must be
// excluded from summary-field matching entirely, not just deprioritized.
const LEADING_DATE_PATTERN =
  /^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}\b|^\d{4}-\d{2}-\d{2}\b|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i;

function findAllMatches(text: string, labels: RegExp[]): { value: number; labelIndex: number; line: string }[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const found: { value: number; labelIndex: number; line: string }[] = [];

  for (const line of lines) {
    if (LEADING_DATE_PATTERN.test(line)) continue;
    if (/\bdate\b/i.test(line)) continue; // e.g. "Next EMI Due Date  05 Jul 2026" — a date field, not an amount

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (!label) continue; // unreachable given the loop bound, but satisfies noUncheckedIndexedAccess
      const pattern = amountPattern(label);
      const match = line.match(pattern);
      if (match?.[1]) {
        const value = parseAmount(match[1]);
        // Sanity floor: reject implausibly small "amounts" (e.g. a
        // day-of-month digit the connector snagged from a nearby date).
        if (value !== null && value >= 10) {
          found.push({ value, labelIndex: i, line });
        }
        break; // first label that matches this line wins for this line
      }
    }
  }
  return found;
}

function pickBestCandidate(
  candidates: { value: number; labelIndex: number; line: string }[],
): { value: number | null; distinctCount: number; bestLabelRank: number } {
  if (candidates.length === 0) {
    return { value: null, distinctCount: 0, bestLabelRank: -1 };
  }

  // Dedupe values within 1 paisa/cent tolerance
  const distinctValues = new Map<number, number>(); // rounded value -> labelIndex of best (lowest) rank seen
  for (const c of candidates) {
    const key = Math.round(c.value * 100);
    const existingRank = distinctValues.get(key);
    if (existingRank === undefined || c.labelIndex < existingRank) {
      distinctValues.set(key, c.labelIndex);
    }
  }

  // Prefer the value found via the most specific (lowest-index) label
  const sorted = [...distinctValues.entries()].sort((a, b) => a[1] - b[1]);
  const best = sorted[0];
  if (!best) {
    // Unreachable: distinctValues is non-empty whenever candidates is
    // non-empty (guarded above), but satisfies noUncheckedIndexedAccess.
    return { value: null, distinctCount: 0, bestLabelRank: -1 };
  }
  const [bestKey, bestRank] = best;

  return {
    value: bestKey / 100,
    distinctCount: distinctValues.size,
    bestLabelRank: bestRank,
  };
}

function findSingleAmount(text: string, label: RegExp): number | null {
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(amountPattern(label));
    if (match?.[1]) {
      const value = parseAmount(match[1]);
      if (value !== null) return value;
    }
  }
  return null;
}

export async function extractDebtFromPdf(pdfBuffer: Buffer): Promise<RuleBasedDebtExtraction> {
  const parser = new PDFParse({ data: pdfBuffer });
  let text: string;

  try {
    const result = await parser.getText();
    text = result.text;
  } finally {
    await parser.destroy();
  }

  const loanSignals = (text.match(LOAN_KEYWORDS) ?? []).length;
  const creditCardSignals = (text.match(CREDIT_CARD_KEYWORDS) ?? []).length;
  const documentTypeGuess: DebtDocumentTypeGuess =
    loanSignals === 0 && creditCardSignals === 0
      ? 'unknown'
      : loanSignals >= creditCardSignals
        ? 'loan_statement'
        : 'credit_card_statement';

  const totalOutstandingCandidates = findAllMatches(text, TOTAL_OUTSTANDING_LABELS);
  const monthlyPaymentCandidates = findAllMatches(text, MONTHLY_PAYMENT_LABELS);

  const totalOutstandingPick = pickBestCandidate(totalOutstandingCandidates);
  const monthlyPaymentPick = pickBestCandidate(monthlyPaymentCandidates);

  const creditLimit = findSingleAmount(text, CREDIT_LIMIT_LABEL);
  const availableCredit = findSingleAmount(text, AVAILABLE_CREDIT_LABEL);
  const previousBalance = findSingleAmount(text, PREVIOUS_BALANCE_LABEL);
  const paymentsReceived = findSingleAmount(text, PAYMENTS_RECEIVED_LABEL);
  const newCharges = findSingleAmount(text, NEW_CHARGES_LABEL);

  // --- Confidence, built around verifiable cross-checks --------------------
  let confidence = 0;
  let hadAnyCrossCheck = false;

  // 1. Credit-card cross-check: creditLimit - availableCredit should roughly
  //    equal totalOutstandingDebt (not exact — some issuers exclude pending
  //    holds/authorizations — so a wider tolerance than the bank-statement
  //    balance-arithmetic check).
  if (creditLimit !== null && availableCredit !== null && totalOutstandingPick.value !== null) {
    const impliedOutstanding = creditLimit - availableCredit;
    const deviation = Math.abs(impliedOutstanding - totalOutstandingPick.value) / Math.max(totalOutstandingPick.value, 1);
    confidence += deviation <= 0.05 ? 0.35 : deviation <= 0.15 ? 0.1 : -0.25;
    hadAnyCrossCheck = true;
  }

  // 2. Credit-card cycle-math cross-check: previousBalance + newCharges -
  //    paymentsReceived should roughly equal totalOutstandingDebt.
  if (
    previousBalance !== null &&
    newCharges !== null &&
    paymentsReceived !== null &&
    totalOutstandingPick.value !== null
  ) {
    const implied = previousBalance + newCharges - paymentsReceived;
    const deviation = Math.abs(implied - totalOutstandingPick.value) / Math.max(totalOutstandingPick.value, 1);
    confidence += deviation <= 0.05 ? 0.3 : deviation <= 0.15 ? 0.1 : -0.2;
    hadAnyCrossCheck = true;
  }

  // 3. Agreement bonus: if the total-outstanding value was found under only
  //    ONE distinct amount across all matching labels (no conflicting
  //    figures anywhere in the document), that's meaningful signal even
  //    without an arithmetic cross-check.
  if (totalOutstandingPick.value !== null && totalOutstandingPick.distinctCount === 1) {
    confidence += 0.2;
  } else if (totalOutstandingPick.distinctCount > 1) {
    confidence -= 0.15; // conflicting figures found — penalize, we picked the most specific label but can't be sure
  }

  if (monthlyPaymentPick.value !== null && monthlyPaymentPick.distinctCount === 1) {
    confidence += 0.15;
  } else if (monthlyPaymentPick.distinctCount > 1) {
    confidence -= 0.1;
  }

  // 4. Document-type classification confidence — did we clearly recognize
  //    this as a debt document at all, vs. guessing from a single stray word?
  if (loanSignals + creditCardSignals >= 3) {
    confidence += 0.1;
  }

  // 5. No arithmetic cross-check was possible at all — cap confidence hard,
  //    same principle as the bank-statement extractor: unverified regex
  //    matches alone are never enough to skip the LLM fallback.
  if (!hadAnyCrossCheck) {
    confidence = Math.min(confidence, 0.4);
  }

  // Both fields missing entirely — nothing to report, force fallback.
  if (totalOutstandingPick.value === null && monthlyPaymentPick.value === null) {
    confidence = 0;
  }

  const summaryParts = [
    `Rule-based debt extraction (${documentTypeGuess}):`,
    totalOutstandingPick.value !== null
      ? `outstanding=${totalOutstandingPick.value}${totalOutstandingPick.distinctCount > 1 ? ` (${totalOutstandingPick.distinctCount} conflicting figures found, used most specific label)` : ''}`
      : 'outstanding=not found',
    monthlyPaymentPick.value !== null
      ? `monthlyPayment=${monthlyPaymentPick.value}${monthlyPaymentPick.distinctCount > 1 ? ` (${monthlyPaymentPick.distinctCount} conflicting figures found, used most specific label)` : ''}`
      : 'monthlyPayment=not found',
    hadAnyCrossCheck ? 'arithmetic cross-check performed' : 'no arithmetic cross-check available',
  ];

  return {
    debt: {
      totalOutstandingDebt: totalOutstandingPick.value,
      monthlyDebtPayment: monthlyPaymentPick.value,
    },
    documentTypeGuess,
    summary: summaryParts.join(' '),
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}