import { validateOutput as validateWithEngine } from './validation/ValidationEngine.js';
import type { ValidationInput } from './validation/ValidationStrategy.js';
import type { ValidationResult } from './validation/ValidationResult.js';
export { ENKRYPT_SAFE_FALLBACK } from './validation/SafetyFallback.js';

export { ValidationMode } from './validation/ValidationMode.js';
export type { ValidationInput, ValidationResult };
export type ValidationRequest = ValidationInput;
export type ValidateOutputResult = ValidationResult;

export async function validateOutput(
  request: ValidationInput,
): Promise<ValidationResult> {
  return validateWithEngine(request);
}
