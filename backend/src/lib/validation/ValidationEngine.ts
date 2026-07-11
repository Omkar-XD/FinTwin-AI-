import { randomUUID } from 'node:crypto';
import { env } from '../env.js';
import type { ContextAdherenceResult } from './ContextAdherenceValidator.js';
import { DecisionEngine } from './DecisionEngine.js';
import { ValidationMode } from './ValidationMode.js';
import type { ValidationInput, ValidationStrategy } from './ValidationStrategy.js';
import type { ValidationResult } from './ValidationResult.js';
import { ValidationLogger } from './ValidationLogger.js';
import { AssistantValidator } from './strategies/AssistantValidator.js';
import { FactualValidator } from './strategies/FactualValidator.js';
import { RecommendationValidator } from './strategies/RecommendationValidator.js';
import { RiskValidator } from './strategies/RiskValidator.js';
import { SimulationValidator } from './strategies/SimulationValidator.js';

type EnkryptAdherenceResponse = {
  summary?: {
    adherence_score?: number;
  };
};

type EnkryptDetectResponse = {
  summary?: {
    toxicity?: number | string[];
    bias?: number;
    policy_violation?: number;
    nsfw?: number;
    injection_attack?: number;
  };
  details?: {
    toxicity?: Record<string, number>;
    bias?: {
      bias_detected?: boolean;
    };
    policy_violation?: {
      violating_policy?: string;
      explanation?: string;
    };
    injection_attack?: {
      detected?: boolean;
      explanation?: string;
    };
  };
};

type SafetyValidationResult = {
  safetyPassed: boolean;
  safetyScore: number;
  safetyIssues: string[];
  warnings: string[];
  validationUnavailable: boolean;
};

const ADHERENCE_THRESHOLD = 0.5;

const SAFETY_POLICY_BY_MODE: Record<ValidationMode, string> = {
  [ValidationMode.FACTUAL]:
    'The response must not fabricate account balances, transaction history, income, expenses, debts, or other financial facts not present in verified context.',
  [ValidationMode.RECOMMENDATION]:
    'The response must not provide investment, tax, or legal advice as guaranteed outcomes. It must not encourage risky borrowing, speculative investments, or harmful financial decisions without recommending professional consultation.',
  [ValidationMode.SIMULATION]:
    'The response must present projections as estimates, not guarantees. It must not encourage financial decisions that could cause harm without caveats and professional consultation.',
  [ValidationMode.ASSISTANT]:
    'The response must not fabricate financial figures, claim guaranteed outcomes, provide harmful financial instructions, or present specific investment, tax, or legal advice as certain.',
  [ValidationMode.RISK_ANALYSIS]:
    'The response must not exaggerate or fabricate risk factors beyond verified data. It must not shame the user or recommend harmful actions.',
};

function isEnkryptServiceUnavailable(status: number): boolean {
  return status === 503 || status === 502 || status === 504 || status === 429;
}

async function callEnkrypt<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  if (!env.enkryptApiKey) {
    return null;
  }

  try {
    const response = await fetch(`${env.enkryptBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.enkryptApiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '<could not read response body>');
      const message = `Enkrypt API ${path} failed with status ${response.status}: ${errorBody}`;
      if (isEnkryptServiceUnavailable(response.status)) {
        console.warn(`${message}; continuing without Enkrypt validation`);
      } else {
        console.error(message);
      }
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn(`Enkrypt API ${path} call failed; continuing without Enkrypt validation:`, error);
    return null;
  }
}

function isToxicityDetected(summary: EnkryptDetectResponse['summary']): boolean {
  if (!summary?.toxicity) {
    return false;
  }

  if (Array.isArray(summary.toxicity)) {
    return summary.toxicity.length > 0;
  }

  if (typeof summary.toxicity === 'number') {
    return summary.toxicity >= 1;
  }

  return false;
}

function getMaxToxicityScore(details: EnkryptDetectResponse['details']): number {
  const scores = details?.toxicity;
  if (!scores) {
    return 0;
  }

  return Math.max(...Object.values(scores), 0);
}

function hasContentIssue(issues: string[]): boolean {
  return issues.some((issue) => !issue.toLowerCase().includes('unavailable'));
}

export class ValidationEngine {
  private readonly strategies: Map<ValidationMode, ValidationStrategy>;
  private readonly decisions = new DecisionEngine();
  private readonly logger = new ValidationLogger();

  constructor() {
    const validateAdherence = this.validateAdherence.bind(this);
    const strategies = [
      new FactualValidator(validateAdherence),
      new RecommendationValidator(validateAdherence),
      new SimulationValidator(validateAdherence),
      new AssistantValidator(validateAdherence),
      new RiskValidator(validateAdherence),
    ];

    this.strategies = new Map(strategies.map((strategy) => [strategy.mode, strategy]));
  }

  async validate(request: ValidationInput): Promise<ValidationResult> {
    const startedAt = Date.now();
    const responseId = randomUUID();
    const strategy = this.strategies.get(request.mode);
    if (!strategy) {
      throw new Error(`No validation strategy registered for mode ${request.mode}`);
    }

    await this.logger.logStart(request, responseId);

    if (!env.enkryptApiKey) {
      const result = this.decisions.decide({
        safetyPassed: true,
        factualPassed: true,
        adherenceScore: 1,
        safetyScore: 1,
        validationMode: request.mode,
        safetyIssues: [],
        factualIssues: [],
        warnings: ['Enkrypt validation unavailable: API key is not configured'],
        responseId,
        durationMs: Date.now() - startedAt,
        validationUnavailable: true,
        finalText: request.text,
        responseReplaced: false,
      });
      await this.logger.logResult(request, result);
      return result;
    }

    const safety = await this.validateSafety(request);

    if (!safety.safetyPassed) {
      const result = this.decisions.decide({
        safetyPassed: false,
        factualPassed: false,
        adherenceScore: 0,
        safetyScore: safety.safetyScore,
        validationMode: request.mode,
        safetyIssues: safety.safetyIssues,
        factualIssues: [],
        warnings: [...safety.warnings, 'Context validation skipped because safety validation failed'],
        responseId,
        durationMs: Date.now() - startedAt,
        validationUnavailable: safety.validationUnavailable,
        finalText: request.text,
        responseReplaced: false,
      });
      await this.logger.logResult(request, result);
      return result;
    }

    const context = await strategy.validateContext(request);
    const contextValidationUnavailable = context.warnings.some((warning) =>
      warning.toLowerCase().includes('unavailable'),
    );
    const result = this.decisions.decide({
      safetyPassed: safety.safetyPassed,
      factualPassed: context.factualPassed,
      adherenceScore: context.adherenceScore,
      safetyScore: safety.safetyScore,
      validationMode: request.mode,
      safetyIssues: safety.safetyIssues,
      factualIssues: context.factualIssues,
      warnings: [...safety.warnings, ...context.warnings],
      responseId,
      durationMs: Date.now() - startedAt,
      validationUnavailable: safety.validationUnavailable || contextValidationUnavailable,
      finalText: request.text,
      responseReplaced: false,
    });
    await this.logger.logResult(request, result);
    return result;
  }

  private async validateSafety(request: ValidationInput): Promise<SafetyValidationResult> {
    const detectResult = await callEnkrypt<EnkryptDetectResponse>('/guardrails/detect', {
      text: request.text,
      detectors: {
        topic_detector: { enabled: false, topic: [] },
        nsfw: { enabled: true },
        toxicity: { enabled: true },
        pii: { enabled: false, entities: [] },
        injection_attack: { enabled: true },
        keyword_detector: { enabled: false, banned_keywords: [] },
        policy_violation: {
          enabled: true,
          policy_text: SAFETY_POLICY_BY_MODE[request.mode],
        },
        bias: { enabled: true },
      },
    });

    if (!detectResult) {
      return {
        safetyPassed: true,
        safetyScore: 1,
        safetyIssues: [],
        warnings: ['Enkrypt safety detection unavailable'],
        validationUnavailable: true,
      };
    }

    const safetyIssues = this.parseSafetyIssues(detectResult);

    return {
      safetyPassed: safetyIssues.length === 0,
      safetyScore: safetyIssues.length === 0 ? 1 : 0,
      safetyIssues,
      warnings: [],
      validationUnavailable: false,
    };
  }

  private async validateAdherence(
    text: string,
    groundTruth: string,
  ): Promise<ContextAdherenceResult> {
    const adherenceResult = await callEnkrypt<EnkryptAdherenceResponse>('/guardrails/adherence', {
      llm_answer: text,
      context: groundTruth,
    });

    if (!adherenceResult) {
      return {
        factualPassed: true,
        adherenceScore: 1,
        factualIssues: [],
        warnings: ['Enkrypt adherence check unavailable'],
        validationUnavailable: true,
      };
    }

    const adherenceScore = adherenceResult.summary?.adherence_score ?? 1;
    const factualIssues = adherenceScore < ADHERENCE_THRESHOLD
      ? [`Response does not adhere to verified context (score: ${adherenceScore.toFixed(2)})`]
      : [];

    return {
      factualPassed: !hasContentIssue(factualIssues),
      adherenceScore,
      factualIssues,
      warnings: [],
      validationUnavailable: false,
    };
  }

  private parseSafetyIssues(detectResult: EnkryptDetectResponse): string[] {
    const issues: string[] = [];

    if (isToxicityDetected(detectResult.summary)) {
      const toxicityScore = getMaxToxicityScore(detectResult.details);
      issues.push(
        toxicityScore > 0
          ? `Toxic content detected (score: ${toxicityScore.toFixed(2)})`
          : 'Toxic content detected',
      );
    }

    if (detectResult.summary?.bias === 1 || detectResult.details?.bias?.bias_detected) {
      issues.push('Bias detected in response');
    }

    if (detectResult.summary?.policy_violation === 1) {
      const explanation = detectResult.details?.policy_violation?.explanation;
      issues.push(
        explanation
          ? `Safety policy violation: ${explanation}`
          : 'Safety policy violation detected',
      );
    }

    if (detectResult.summary?.nsfw === 1) {
      issues.push('NSFW content detected');
    }

    if (
      detectResult.summary?.injection_attack === 1
      || detectResult.details?.injection_attack?.detected
    ) {
      const explanation = detectResult.details?.injection_attack?.explanation;
      issues.push(explanation ? `Prompt injection detected: ${explanation}` : 'Prompt injection detected');
    }

    return issues;
  }
}

const validationEngine = new ValidationEngine();

export async function validateOutput(input: ValidationInput): Promise<ValidationResult> {
  return validationEngine.validate(input);
}
