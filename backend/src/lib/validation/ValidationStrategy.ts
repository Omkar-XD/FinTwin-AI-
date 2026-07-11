import type { ValidationMode } from './ValidationMode.js';

export interface ValidationInput {
  mode: ValidationMode;
  text: string;
  context: Record<string, unknown>;
  metadata: {
    agentName: string;
    userId: string;
    projection?: Record<string, unknown>;
    scenarioType?: string;
    projectionHorizon?: string;
    recommendationType?: string;
    riskScoreSource?: string;
    [key: string]: unknown;
  };
}

export interface ValidationStrategy {
  mode: ValidationMode;
  validateContext(input: ValidationInput): Promise<{
    factualPassed: boolean;
    adherenceScore: number;
    factualIssues: string[];
    warnings: string[];
  }>;
}
