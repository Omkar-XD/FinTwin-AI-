import { z } from 'zod';

export const scenarioTypes = [
  'vehicle_purchase',
  'new_loan',
  'increase_investments',
  'salary_change',
  'increase_savings',
  'early_loan_repayment',
] as const;

export type ScenarioType = (typeof scenarioTypes)[number];

export const scenarioTypeSchema = z.enum(scenarioTypes);

export type BaselineFinancialProfile = {
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  savings: number | null;
  totalDebt: number | null;
  netWorth: number | null;
  cashFlow: number | null;
  currencySymbol: string;
};

export type VehiclePurchaseParams = {
  purchasePrice?: number;
  downPayment?: number;
  loanAmount?: number;
  interestRate?: number;
};

export type NewLoanParams = {
  loanAmount?: number;
  interestRate?: number;
};

export type IncreaseInvestmentsParams = {
  investmentIncrease?: number;
  investmentIncreasePercent?: number;
};

export type SalaryChangeParams = {
  salaryChangeAmount?: number;
  salaryChangePercent?: number;
};

export type IncreaseSavingsParams = {
  savingsIncrease?: number;
  savingsIncreasePercent?: number;
};

export type EarlyLoanRepaymentParams = {
  repaymentAmount?: number;
};

export type ScenarioParametersByType = {
  vehicle_purchase: VehiclePurchaseParams;
  new_loan: NewLoanParams;
  increase_investments: IncreaseInvestmentsParams;
  salary_change: SalaryChangeParams;
  increase_savings: IncreaseSavingsParams;
  early_loan_repayment: EarlyLoanRepaymentParams;
};

export type ScenarioParameters<T extends ScenarioType = ScenarioType> =
  ScenarioParametersByType[T];

export type ScenarioContext<T extends ScenarioType = ScenarioType> = {
  baseline: BaselineFinancialProfile;
  scenarioType: T;
  scenarioParameters: ScenarioParameters<T>;
  projectionAssumptions: string[];
  projectionHorizon: string;
};

type ScenarioDefinition<T extends ScenarioType> = {
  type: T;
  allowedParams: readonly (keyof ScenarioParametersByType[T])[];
  aliases: Partial<Record<string, keyof ScenarioParametersByType[T]>>;
};

export const scenarioRegistry = {
  vehicle_purchase: {
    type: 'vehicle_purchase',
    allowedParams: ['purchasePrice', 'downPayment', 'loanAmount', 'interestRate'],
    aliases: {
      price: 'purchasePrice',
      vehiclePrice: 'purchasePrice',
      carPrice: 'purchasePrice',
      purchaseAmount: 'purchasePrice',
      rate: 'interestRate',
    },
  },
  new_loan: {
    type: 'new_loan',
    allowedParams: ['loanAmount', 'interestRate'],
    aliases: {
      amount: 'loanAmount',
      principal: 'loanAmount',
      rate: 'interestRate',
    },
  },
  increase_investments: {
    type: 'increase_investments',
    allowedParams: ['investmentIncrease', 'investmentIncreasePercent'],
    aliases: {
      amount: 'investmentIncrease',
      increaseAmount: 'investmentIncrease',
      increasePercent: 'investmentIncreasePercent',
      percent: 'investmentIncreasePercent',
      percentage: 'investmentIncreasePercent',
    },
  },
  salary_change: {
    type: 'salary_change',
    allowedParams: ['salaryChangeAmount', 'salaryChangePercent'],
    aliases: {
      amount: 'salaryChangeAmount',
      salaryIncrease: 'salaryChangeAmount',
      increaseAmount: 'salaryChangeAmount',
      increasePercent: 'salaryChangePercent',
      percent: 'salaryChangePercent',
      percentage: 'salaryChangePercent',
    },
  },
  increase_savings: {
    type: 'increase_savings',
    allowedParams: ['savingsIncrease', 'savingsIncreasePercent'],
    aliases: {
      amount: 'savingsIncrease',
      increaseAmount: 'savingsIncrease',
      increase: 'savingsIncrease',
      monthlySavingsIncrease: 'savingsIncrease',
      savingsIncreaseAmount: 'savingsIncrease',
      increasePercent: 'savingsIncreasePercent',
      percent: 'savingsIncreasePercent',
      percentage: 'savingsIncreasePercent',
      savingsPercent: 'savingsIncreasePercent',
      savingsRate: 'savingsIncreasePercent',
    },
  },
  early_loan_repayment: {
    type: 'early_loan_repayment',
    allowedParams: ['repaymentAmount'],
    aliases: {
      amount: 'repaymentAmount',
      extraPayment: 'repaymentAmount',
      prepayment: 'repaymentAmount',
    },
  },
} as const satisfies {
  [T in ScenarioType]: ScenarioDefinition<T>;
};

const rawParamsSchema = z.record(z.unknown()).default({});

export const scenarioRequestSchema = z.object({
  scenarioType: scenarioTypeSchema,
  params: rawParamsSchema,
});

export const scenarioToolInputSchema = scenarioRequestSchema;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseNumericInput(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return undefined;
  }

  const normalized = trimmed.replace(/[,₹$€£\s]/g, '').replace(/%$/, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeScenarioParameters<T extends ScenarioType>(
  scenarioType: T,
  rawParams: unknown,
): ScenarioParameters<T> {
  const definition = scenarioRegistry[scenarioType];
  const source = isRecord(rawParams) ? rawParams : {};
  const normalized: Record<string, number> = {};
  const aliases = definition.aliases as Record<string, string>;
  const allowedParams = new Set<string>(definition.allowedParams as readonly string[]);

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const canonicalKey = aliases[rawKey] ?? rawKey;
    if (!allowedParams.has(canonicalKey)) {
      continue;
    }

    const numericValue = parseNumericInput(rawValue);
    if (numericValue !== undefined) {
      normalized[canonicalKey] = numericValue;
    }
  }

  return normalized as ScenarioParameters<T>;
}

export function buildBaselineFinancialProfile(
  profile: Record<string, unknown> | null,
  currencySymbol: string,
): BaselineFinancialProfile {
  return {
    monthlyIncome: getNullableNumber(profile, 'monthly_income'),
    monthlyExpenses: getNullableNumber(profile, 'monthly_expenses'),
    savings: getNullableNumber(profile, 'savings'),
    totalDebt: getNullableNumber(profile, 'total_debt'),
    netWorth: getNullableNumber(profile, 'net_worth'),
    cashFlow: getNullableNumber(profile, 'cash_flow'),
    currencySymbol,
  };
}

export function buildScenarioContext<T extends ScenarioType>(input: {
  baseline: BaselineFinancialProfile;
  scenarioType: T;
  scenarioParameters: ScenarioParameters<T>;
  projectionAssumptions?: string[];
  projectionHorizon?: string;
}): ScenarioContext<T> {
  return {
    baseline: input.baseline,
    scenarioType: input.scenarioType,
    scenarioParameters: input.scenarioParameters,
    projectionAssumptions: input.projectionAssumptions ?? [],
    projectionHorizon: input.projectionHorizon ?? '12/24/36 months',
  };
}

function getNullableNumber(
  source: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = source?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function extractSavingsPercentQuestion(message: string): number | null {
  const normalized = message.toLowerCase();
  if (!/\bsav(e|ing|ings)\b/.test(normalized) || !/\bincome\b/.test(normalized)) {
    return null;
  }

  const match = normalized.match(/\b(?:up to|upto|save|saving|savings)?\s*(\d+(?:\.\d+)?)\s*%/);
  if (!match?.[1]) {
    return null;
  }

  const percent = Number(match[1]);
  return Number.isFinite(percent) && percent >= 0 ? percent : null;
}

export function calculateSavingsTargetFromIncome(input: {
  baseline: BaselineFinancialProfile;
  savingsIncreasePercent: number;
}): { available: true; targetSavings: number } | { available: false; reason: string } {
  if (input.baseline.monthlyIncome == null) {
    return {
      available: false,
      reason: 'Monthly income is missing from the verified profile.',
    };
  }

  return {
    available: true,
    targetSavings: (input.baseline.monthlyIncome * input.savingsIncreasePercent) / 100,
  };
}
