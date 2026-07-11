export type HealthStatus = {
  status: 'ok';
  timestamp: string;
  uptime: number;
};

export type ApiError = {
  error: string;
  message?: string;
};

export type { ValidateOutputResult } from '../lib/enkrypt.js';
export { validateOutput, ENKRYPT_SAFE_FALLBACK } from '../lib/enkrypt.js';

export type {
  AnalyzeDocumentResponse,
  DocType,
  DocumentStatus,
  DocumentStatusResponse,
  UploadDocumentResponse,
} from './documents.js';

export type { RecommendationStatus } from './recommendations.js';

export {
  DOC_TYPES,
  DOCUMENT_STATUSES,
  documentStatusSchema,
  isActiveDocumentStatus,
  isDocumentStatus,
} from './documents.js';

export {
  RECOMMENDATION_STATUSES,
  recommendationStatusSchema,
} from './recommendations.js';
