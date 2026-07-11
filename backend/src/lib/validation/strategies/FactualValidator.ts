import type { ContextAdherenceValidator } from '../ContextAdherenceValidator.js';
import { ValidationMode } from '../ValidationMode.js';
import type { ValidationInput, ValidationStrategy } from '../ValidationStrategy.js';

export class FactualValidator implements ValidationStrategy {
  mode = ValidationMode.FACTUAL;

  constructor(private readonly validateAdherence: ContextAdherenceValidator) {}

  validateContext(input: ValidationInput) {
    return this.validateAdherence(
      input.text,
      JSON.stringify(
        {
          factualContext: input.context,
          instruction:
            'Strictly validate every factual statement and numerical value against verified financial data. Reject hallucinated facts. Do not require advice, reasoning, or projections to match context.',
        },
        null,
        2,
      ),
    );
  }
}
