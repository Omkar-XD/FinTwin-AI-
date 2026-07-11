import type { Context } from 'hono';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_FILE'
  | 'UNSUPPORTED_FILE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'MALFORMED_JSON'
  | 'SCHEMA_VALIDATION'
  | 'GEMINI_TIMEOUT'
  | 'SUPABASE_ERROR'
  | 'INTERNAL_ERROR';

type ApiErrorStatus = 400 | 401 | 403 | 404 | 422 | 500 | 504;

export function errorResponse(
  c: Context,
  status: ApiErrorStatus,
  error: string,
  code: ErrorCode,
) {
  return c.json({ error, code }, status);
}

export function messageFromError(error: unknown, fallback: string): string {
  if (isInternalProviderError(error)) {
    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export function internalErrorMessage(error: unknown, fallback: string): string {
  return isInternalProviderError(error) ? fallback : messageFromError(error, fallback);
}

function isInternalProviderError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const message = typeof record['message'] === 'string' ? record['message'] : '';
  const code = typeof record['code'] === 'string' ? record['code'] : '';
  const statusCode = typeof record['statusCode'] === 'number' ? record['statusCode'] : undefined;
  const responseBody = typeof record['responseBody'] === 'string' ? record['responseBody'] : '';

  return (
    code === 'tool_use_failed'
    || ((statusCode === 400) && responseBody.includes('failed_generation'))
    || message.includes('Failed to call a function')
    || responseBody.includes('tool_use_failed')
    || responseBody.includes('failed_generation')
  );
}
