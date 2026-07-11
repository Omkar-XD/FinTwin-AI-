import { Agent } from '@mastra/core/agent';
import { acquireGroqTokens, estimateTokens } from './groq-limiter.js';
import {
  GROQ_CHAT_MODEL,
  GROQ_CHAT_MODEL_LABEL,
  GROQ_COMPLETION_TOKEN_BUDGET,
} from './models.js';

const DEFAULT_TIMEOUT_MS = 30_000;

function isRateLimitError(err: unknown): boolean {
  const e = err as { statusCode?: number; message?: string };
  return (
    e?.statusCode === 429 ||
    (typeof e?.message === 'string' && e.message.toLowerCase().includes('rate limit'))
  );
}

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, waitMs = 2500): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isRateLimitError(err) && retries > 0) {
      console.warn(`Groq rate limited, retrying in ${waitMs}ms (${retries} retries left)`);
      await new Promise((r) => setTimeout(r, waitMs));
      return callWithRetry(fn, retries - 1, waitMs * 1.5);
    }
    throw err;
  }
}

const sharedGroqAgent = new Agent({
  id: 'sharedGroqLlm',
  name: 'Shared Groq LLM',
  instructions: 'You are a helpful financial AI assistant.',
  model: GROQ_CHAT_MODEL,
});

async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function callLLM(
  prompt: string,
  systemPrompt = 'You are a helpful financial AI assistant.',
): Promise<string> {
  await acquireGroqTokens(
    estimateTokens(prompt) + estimateTokens(systemPrompt) + GROQ_COMPLETION_TOKEN_BUDGET,
  );

  const response = await callWithRetry(() =>
    withTimeout(
      sharedGroqAgent.generate(prompt, {
        instructions: systemPrompt,
        modelSettings: {
          temperature: 0.2,
        },
      }),
      `${GROQ_CHAT_MODEL_LABEL} request`,
    ),
  );

  const content = response.text.trim();

  if (!content) {
    throw new Error(`${GROQ_CHAT_MODEL_LABEL} returned an empty response`);
  }

  console.log(`LLM response served by ${GROQ_CHAT_MODEL_LABEL}`);
  return content;
}

export function parseJsonFromLLM<T>(text: string, fallback: T): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const objectStart = candidate.indexOf('{');
    const objectEnd = candidate.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(candidate.slice(objectStart, objectEnd + 1)) as T;
      } catch {
        return fallback;
      }
    }

    return fallback;
  }
}

export function parseStrictJsonFromLLM(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const objectStart = candidate.indexOf('{');
    const objectEnd = candidate.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(candidate.slice(objectStart, objectEnd + 1));
    }

    throw new Error('Response did not contain valid JSON');
  }
}