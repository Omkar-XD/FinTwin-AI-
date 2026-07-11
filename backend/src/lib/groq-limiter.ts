import { getRedis } from './redis.js';

const GROQ_TPM_WINDOW_MS = 60_000;
const GROQ_TPM_KEY = 'groq:tpm:window';
const GROQ_TPM_ENTRY_TTL_MS = GROQ_TPM_WINDOW_MS + 1_000;
const GROQ_TPM_MAX_WAIT_MS = 15_000;
const GROQ_TPM_INITIAL_POLL_MS = 500;
const GROQ_TPM_MAX_POLL_MS = 1_500;
const GROQ_TPM_REDIS_TIMEOUT_MS = 1_000;

const configuredGroqTpmLimit = Number.parseInt(process.env['GROQ_TPM_LIMIT'] ?? '', 10);

export const GROQ_TPM_LIMIT = Number.isFinite(configuredGroqTpmLimit) && configuredGroqTpmLimit > 0
  ? configuredGroqTpmLimit
  : 12_000;

const ACQUIRE_GROQ_TOKENS_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local member = ARGV[5]
local ttl = tonumber(ARGV[6])

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

local entries = redis.call('ZRANGE', key, 0, -1)
local total = 0

for _, entry in ipairs(entries) do
  local tokens = tonumber(string.match(entry, '^[^:]+:(%d+):')) or 0
  total = total + tokens
end

if total + requested <= limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, ttl)
  return {1, total + requested}
end

redis.call('PEXPIRE', key, ttl)
return {0, total}
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRedisTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Groq Redis rate limiter timed out')),
          GROQ_TPM_REDIS_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function createLimiterMember(now: number, tokens: number): string {
  return `${now}:${tokens}:${process.pid}:${Math.random().toString(36).slice(2)}`;
}

/**
 * Roughly estimates LLM token usage from text length.
 *
 * This is intentionally approximate, not tokenizer-exact. It is used for
 * admission control against Groq's org-wide TPM budget, while Groq's own API
 * remains the source of truth for final token accounting.
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 3.2));
}

/**
 * Reserves estimated Groq tokens inside a Redis-backed rolling 60-second window.
 *
 * Groq's TPM limit is shared across the whole org, so independent Mastra agents
 * and multiple server instances can otherwise overlap and collectively exceed
 * the budget. The limiter stores reservations in a Redis sorted set scored by
 * timestamp, prunes entries older than 60 seconds, sums remaining token counts,
 * and conditionally records the new reservation in one Lua script so concurrent
 * callers observe a shared sliding window.
 *
 * Redis is treated as a best-effort dependency: if it is unavailable, this
 * function logs a warning and allows the LLM call through. Groq 429 responses
 * and existing retry logic remain the fallback safety net.
 */
export async function acquireGroqTokens(estimatedTokens: number): Promise<void> {
  const requestedTokens = Math.max(1, Math.ceil(estimatedTokens));

  if (requestedTokens > GROQ_TPM_LIMIT) {
    throw new Error('Groq rate limit budget exhausted; try again shortly');
  }

  let redis: ReturnType<typeof getRedis>;
  try {
    redis = getRedis();
  } catch (error) {
    console.warn('Groq Redis rate limiter unavailable; allowing request through:', error);
    return;
  }

  const deadline = Date.now() + GROQ_TPM_MAX_WAIT_MS;
  let pollMs = GROQ_TPM_INITIAL_POLL_MS;

  while (Date.now() <= deadline) {
    const now = Date.now();
    const windowStart = now - GROQ_TPM_WINDOW_MS;
    const member = createLimiterMember(now, requestedTokens);

    try {
      const result = await withRedisTimeout(
        redis.eval(
          ACQUIRE_GROQ_TOKENS_SCRIPT,
          1,
          GROQ_TPM_KEY,
          String(now),
          String(windowStart),
          String(GROQ_TPM_LIMIT),
          String(requestedTokens),
          member,
          String(GROQ_TPM_ENTRY_TTL_MS),
        ),
      );

      if (Array.isArray(result) && Number(result[0]) === 1) {
        return;
      }
    } catch (error) {
      console.warn('Groq Redis rate limiter unavailable; allowing request through:', error);
      return;
    }

    const remainingWaitMs = deadline - Date.now();
    if (remainingWaitMs <= 0) {
      break;
    }

    await sleep(Math.min(pollMs, remainingWaitMs));
    pollMs = Math.min(Math.ceil(pollMs * 1.5), GROQ_TPM_MAX_POLL_MS);
  }

  throw new Error('Groq rate limit budget exhausted; try again shortly');
}
