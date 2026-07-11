import { createValidationResult, type CreateValidationResultInput, type ValidationResult } from './ValidationResult.js';
import { ENKRYPT_SAFE_FALLBACK } from './SafetyFallback.js';

export class DecisionEngine {
  decide(input: CreateValidationResultInput): ValidationResult {
    const warnings = [...input.warnings];
    let finalText = input.finalText;
    let responseReplaced = input.responseReplaced;

    if (!input.safetyPassed) {
      warnings.push('Safety validation failed; response must be replaced with safe fallback');
      finalText = ENKRYPT_SAFE_FALLBACK;
      responseReplaced = true;
    } else if (!input.factualPassed) {
      warnings.push('Context validation failed; original response returned with validation issues persisted');
      finalText = input.finalText;
      responseReplaced = false;
    }

    return createValidationResult({
      ...input,
      warnings,
      finalText,
      responseReplaced,
    });
  }
}
