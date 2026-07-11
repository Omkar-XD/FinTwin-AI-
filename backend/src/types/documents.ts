import { z } from 'zod';

export const DOC_TYPES = [
  'bank_statement',
  'salary_slip',
  'credit_card',
  'loan_statement',
] as const;

export const DOCUMENT_STATUSES = [
  'uploaded',
  'analyzing',
  'processing',
  'completed',
  'failed',
] as const;

export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);

export type DocType = (typeof DOC_TYPES)[number];
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export type UploadDocumentResponse = {
  documentId: string;
  status: 'uploaded';
};

export type AnalyzeDocumentResponse = {
  documentId: string;
  status: 'completed';
};

export type DocumentStatusResponse = {
  documentId: string;
  status: DocumentStatus;
};

export function isDocumentStatus(value: string): value is DocumentStatus {
  return documentStatusSchema.safeParse(value).success;
}

export function isActiveDocumentStatus(status: string | null | undefined): boolean {
  return status === 'analyzing' || status === 'processing';
}
