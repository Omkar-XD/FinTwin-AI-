export type ContextAdherenceResult = {
  factualPassed: boolean;
  adherenceScore: number;
  factualIssues: string[];
  warnings: string[];
  validationUnavailable: boolean;
};

export type ContextAdherenceValidator = (
  text: string,
  groundTruth: string,
) => Promise<ContextAdherenceResult>;
