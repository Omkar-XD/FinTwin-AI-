import type { ContextAdherenceValidator } from '../ContextAdherenceValidator.js';
import { ClaimParser } from '../assistant/ClaimParser.js';
import { ClaimType } from '../assistant/ClaimType.js';
import { ValidationMode } from '../ValidationMode.js';
import type { ValidationInput, ValidationStrategy } from '../ValidationStrategy.js';

export class AssistantValidator implements ValidationStrategy {
  mode = ValidationMode.ASSISTANT;
  private readonly claimParser = new ClaimParser();

  constructor(private readonly validateAdherence: ContextAdherenceValidator) {}

  validateContext(input: ValidationInput) {
    const claims = this.claimParser.parse(input.text);
    const factClaims = claims.filter((claim) => claim.type === ClaimType.FACT);

    if (factClaims.length === 0) {
      return Promise.resolve({
        factualPassed: true,
        adherenceScore: 1,
        factualIssues: [],
        warnings: ['Assistant response contained no factual claims requiring adherence validation'],
      });
    }

    return this.validateAdherence(
      factClaims.map((claim) => claim.text).join('\n'),
      JSON.stringify(
        {
          financialProfile: input.context['financialProfile'],
          riskScore: input.context['riskScore'],
          memory: input.context['memory'],
          recentConversation: input.context['recentConversation'],
          question: input.context['question'],
          factClaims,
          skippedClaims: claims.filter((claim) => claim.type !== ClaimType.FACT),
          instruction:
            'Validate only FACT claims against available profile, risk, memory, and conversation context. RECOMMENDATION, EXPLANATION, and PREDICTION claims are intentionally excluded from adherence scoring.',
        },
        null,
        2,
      ),
    );
  }
}
