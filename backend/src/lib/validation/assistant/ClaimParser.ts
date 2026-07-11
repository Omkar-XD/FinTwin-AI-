import { ClaimType } from './ClaimType.js';

export type ParsedClaim = {
  text: string;
  type: ClaimType;
};

const RECOMMENDATION_PATTERN = /\b(should|could|recommend|consider|prioritize|suggest|next step)\b/i;
const PREDICTION_PATTERN = /\b(project|projection|simulate|scenario|months?\s*\d+|future|will likely|could lead)\b/i;
const EXPLANATION_PATTERN = /\b(because|means|indicates|suggests that|this is due to|risk|debt|cash flow|liquidity|emergency fund|overdue)\b/i;

export class ClaimParser {
  parse(text: string): ParsedClaim[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((claim) => claim.trim())
      .filter(Boolean)
      .map((claim) => ({
        text: claim,
        type: this.classify(claim),
      }));
  }

  private classify(claim: string): ClaimType {
    if (RECOMMENDATION_PATTERN.test(claim)) return ClaimType.RECOMMENDATION;
    if (PREDICTION_PATTERN.test(claim)) return ClaimType.PREDICTION;
    if (EXPLANATION_PATTERN.test(claim)) return ClaimType.EXPLANATION;
    return ClaimType.FACT;
  }
}
