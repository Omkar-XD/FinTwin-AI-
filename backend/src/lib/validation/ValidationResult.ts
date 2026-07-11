import type { ValidationMode } from './ValidationMode.js';

export interface ValidationResult {
  safetyPassed: boolean;
  factualPassed: boolean;
  adherenceScore: number;
  safetyScore: number;
  validationMode: ValidationMode;
  safetyIssues: string[];
  factualIssues: string[];
  warnings: string[];
  responseId: string;
  durationMs: number;
  validationUnavailable: boolean;
  finalText: string;
  responseReplaced: boolean;
}

export type CreateValidationResultInput = ValidationResult;

export function createValidationResult(input: CreateValidationResultInput): ValidationResult {
  return input;
}
