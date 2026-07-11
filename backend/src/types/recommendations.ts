import { z } from 'zod';

export const RECOMMENDATION_STATUSES = [
  'approved',
  'pending_review',
  'rejected',
] as const;

export const recommendationStatusSchema = z.enum(RECOMMENDATION_STATUSES);

export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;
