import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBaselineFinancialProfile,
  calculateSavingsTargetFromIncome,
  extractSavingsPercentQuestion,
  normalizeScenarioParameters,
  scenarioRequestSchema,
  scenarioToolInputSchema,
} from './scenarios.js';

test('normalizes increase_savings aliases and ignores unrelated baseline params', () => {
  const params = normalizeScenarioParameters('increase_savings', {
    increasePercent: '60%',
    monthlyIncome: 70_986.83,
    savings: 116_149.46,
    loanAmount: 500_000,
  });

  assert.deepEqual(params, {
    savingsIncreasePercent: 60,
  });
});

test('normalizes string numbers and currency values for scenario-specific params', () => {
  const params = normalizeScenarioParameters('vehicle_purchase', {
    vehiclePrice: '₹1,200,000',
    downPayment: '200000',
    interestRate: '9.5%',
    repaymentAmount: 50_000,
  });

  assert.deepEqual(params, {
    purchasePrice: 1_200_000,
    downPayment: 200_000,
    interestRate: 9.5,
  });
});

test('shared scenario request schemas accept raw params for later normalization', () => {
  const payload = {
    scenarioType: 'increase_savings',
    params: {
      savingsIncreasePercent: '60%',
      monthlyExpenses: 69_291.02,
    },
  };

  assert.equal(scenarioRequestSchema.safeParse(payload).success, true);
  assert.equal(scenarioToolInputSchema.safeParse(payload).success, true);
});

test('extracts savings percentage questions deterministically', () => {
  assert.equal(
    extractSavingsPercentQuestion('if i save up to 60% of my income next month what will be my savings'),
    60,
  );
  assert.equal(extractSavingsPercentQuestion('what is my income'), null);
});

test('calculates savings target from baseline income without requiring params to include baseline data', () => {
  const baseline = buildBaselineFinancialProfile(
    {
      monthly_income: 70_986.83,
      monthly_expenses: 69_291.02,
      savings: 116_149.46,
      total_debt: null,
      net_worth: 116_149.46,
      cash_flow: 1_695.81,
    },
    '₹',
  );

  const result = calculateSavingsTargetFromIncome({
    baseline,
    savingsIncreasePercent: 60,
  });

  assert.deepEqual(result, {
    available: true,
    targetSavings: 42_592.098,
  });
});
