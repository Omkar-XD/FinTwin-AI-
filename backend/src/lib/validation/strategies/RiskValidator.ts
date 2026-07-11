import type { ContextAdherenceValidator } from '../ContextAdherenceValidator.js';
import { ValidationMode } from '../ValidationMode.js';
import type { ValidationInput, ValidationStrategy } from '../ValidationStrategy.js';

export class RiskValidator implements ValidationStrategy {
  mode = ValidationMode.RISK_ANALYSIS;

  constructor(private readonly validateAdherence: ContextAdherenceValidator) {}

  validateContext(input: ValidationInput) {
    return this.validateAdherence(
      input.text,
      JSON.stringify(
        {
          riskRelevantFields: {
            currentProfile: this.pickRiskFields(
              (input.context['currentProfile'] ?? input.context['financialProfile']) as Record<string, unknown> | null,
            ),
            riskAssessment: this.pickRiskFields(input.context['riskScore'] as Record<string, unknown> | null),
            extractedData: this.pickRiskFields(
              (input.context['extractedData'] ?? input.context['latestExtraction']) as Record<string, unknown> | null,
            ),
          },
          historicalSnapshots: input.context['historicalSnapshots'],
          riskScoreSource: input.metadata.riskScoreSource,
          instruction:
            'Validate only risk-relevant fields: risk score, risk factors, cash flow, credit utilization, debt ratio, and savings adequacy. Ignore embedded recommendation text when scoring factual adherence.',
        },
        null,
        2,
      ),
    );
  }

  private pickRiskFields(source: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!source) {
      return null;
    }

    return {
      risk_score: source['risk_score'] ?? source['riskScore'],
      risk_factors: source['risk_factors'] ?? source['riskFactors'],
      cash_flow_status: source['cash_flow_status'] ?? source['cashFlowStatus'],
      cash_flow: source['cash_flow'] ?? source['cashFlow'],
      credit_utilization: source['credit_utilization'] ?? source['creditUtilization'],
      debt_to_income: source['debt_to_income'] ?? source['debtToIncome'],
      total_debt: source['total_debt'] ?? source['totalDebt'],
      savings_adequacy: source['savings_adequacy'] ?? source['savingsAdequacy'],
      savings: source['savings'],
    };
  }
}
