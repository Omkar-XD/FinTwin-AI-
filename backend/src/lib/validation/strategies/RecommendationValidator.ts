import type { ContextAdherenceValidator } from '../ContextAdherenceValidator.js';
import { ValidationMode } from '../ValidationMode.js';
import type { ValidationInput, ValidationStrategy } from '../ValidationStrategy.js';

export class RecommendationValidator implements ValidationStrategy {
  mode = ValidationMode.RECOMMENDATION;

  constructor(private readonly validateAdherence: ContextAdherenceValidator) {}

  validateContext(input: ValidationInput) {
    return this.validateAdherence(
      input.text,
      JSON.stringify(
        {
          financialProfile: input.context['financialProfile'],
          riskScore: input.context['riskScore'],
          profileHistory: input.context['profileHistory'],
          pastRecommendations: input.context['pastRecommendations'],
          latestExtraction: input.context['latestExtraction'],
          recommendationType: input.metadata.recommendationType,
          instruction:
            'Validate that recommendations are supported by profile, spending, debt, and risk data. Reasoning is expected and should not be penalized. Do not require wording to match retrieved memory verbatim.',
        },
        null,
        2,
      ),
    );
  }
}
