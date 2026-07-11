import type { ValidationInput } from './ValidationStrategy.js';
import type { ValidationResult } from './ValidationResult.js';
import type { Json } from '../database.types.js';
import { getSupabase } from '../supabase.js';

export enum ValidationLogEvent {
  START = 'VALIDATION_START',
  SUCCESS = 'VALIDATION_SUCCESS',
  WARNING = 'VALIDATION_WARNING',
  FAILED = 'VALIDATION_FAILED',
}

type ValidationLogRecord = {
  user_id: string;
  agent: string;
  validation_mode: string;
  event_type: ValidationLogEvent;
  response_id: string;
  duration_ms: number | null;
  adherence_score: number | null;
  safety_score: number | null;
  passed_safety: boolean;
  passed_factual: boolean;
  issues: Json;
  warnings: Json;
  response_preview: string | null;
};

function toIssuePayload(result: ValidationResult | null): Json {
  if (!result) {
    return [];
  }

  return [
    ...result.safetyIssues.map((issue) => ({ type: 'safety', message: issue })),
    ...result.factualIssues.map((issue) => ({ type: 'factual', message: issue })),
  ];
}

function getResultEvent(result: ValidationResult): ValidationLogEvent {
  if (!result.safetyPassed || !result.factualPassed) {
    return ValidationLogEvent.FAILED;
  }

  if (result.warnings.length > 0 || result.validationUnavailable) {
    return ValidationLogEvent.WARNING;
  }

  return ValidationLogEvent.SUCCESS;
}

export class ValidationLogger {
  async logStart(request: ValidationInput, responseId: string): Promise<void> {
    await this.emit(request, ValidationLogEvent.START, responseId, null);
  }

  async logResult(request: ValidationInput, result: ValidationResult): Promise<void> {
    const event = getResultEvent(result);
    await this.emit(request, event, result.responseId, result);

    if (
      result.validationUnavailable
      || result.safetyIssues.length > 0
      || result.factualIssues.length > 0
      || result.warnings.length > 0
    ) {
      console.warn('LLM output validation completed with issues', {
        event,
        agent: request.metadata.agentName,
        mode: request.mode,
        responseId: result.responseId,
        durationMs: result.durationMs,
        adherenceScore: result.adherenceScore,
        safetyScore: result.safetyScore,
        issues: toIssuePayload(result),
        warnings: result.warnings,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async emit(
    request: ValidationInput,
    event: ValidationLogEvent,
    responseId: string,
    result: ValidationResult | null,
  ): Promise<void> {
    const record: ValidationLogRecord = {
      user_id: request.metadata.userId,
      agent: request.metadata.agentName,
      validation_mode: request.mode,
      event_type: event,
      response_id: responseId,
      duration_ms: result?.durationMs ?? null,
      adherence_score: result?.adherenceScore ?? null,
      safety_score: result?.safetyScore ?? null,
      passed_safety: result?.safetyPassed ?? true,
      passed_factual: result?.factualPassed ?? true,
      issues: toIssuePayload(result),
      warnings: result?.warnings ?? [],
      response_preview: request.text.slice(0, 500),
    };

    console.info('VALIDATION_EVENT', {
      event,
      agent: record.agent,
      mode: record.validation_mode,
      adherenceScore: record.adherence_score,
      safetyScore: record.safety_score,
      durationMs: record.duration_ms,
      issues: record.issues,
      timestamp: new Date().toISOString(),
      responseId,
    });

    try {
      const { error } = await getSupabase().from('validation_logs').insert(record);
      if (error) {
        console.error('Failed to persist validation log event', {
          event,
          responseId,
          error,
          issues: record.issues,
          warnings: record.warnings,
        });
      }
    } catch (error) {
      console.error('Validation log persistence threw an error', {
        event,
        responseId,
        error,
        issues: record.issues,
        warnings: record.warnings,
      });
    }
  }
}
