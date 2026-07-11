import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env.js';
import { GEMINI_DOCUMENT_MODEL } from './models.js';

const GEMINI_DOCUMENT_TIMEOUT_MS = 60_000; // was 90_000 — first attempt
const GEMINI_RETRY_TIMEOUT_MS = 45_000; // shorter on retry — if genuinely stuck, don't wait as long twice

let client: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!client) {
    if (!env.googleGenerativeAiApiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY must be set for document analysis');
    }

    client = new GoogleGenerativeAI(env.googleGenerativeAiApiKey);
  }

  return client;
}

export class GeminiTimeoutError extends Error {
  constructor(timeoutMs: number = GEMINI_DOCUMENT_TIMEOUT_MS) {
    super(`Gemini document analysis timed out after ${timeoutMs}ms`);
    this.name = 'GeminiTimeoutError';
  }
}

export class GeminiMalformedJsonError extends Error {
  constructor(message = 'Gemini returned malformed JSON') {
    super(message);
    this.name = 'GeminiMalformedJsonError';
  }
}

async function generateJsonFromPdfOnce(
  pdfBuffer: Buffer,
  prompt: string,
  systemInstruction: string,
  timeoutMs: number,
): Promise<string> {
  const model = getGeminiClient().getGenerativeModel({
    model: GEMINI_DOCUMENT_MODEL,
    systemInstruction,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    const result = await Promise.race([
      model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBuffer.toString('base64'),
          },
        },
      ]),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new GeminiTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);

    const text = result.response.text().trim();
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    return text;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Calls Gemini once with a 60s timeout. If that attempt times out
 * specifically (not other errors — malformed responses, auth failures, etc.
 * bail immediately), retries exactly once with a shorter 45s timeout. This
 * is a single bounded retry, not a backoff loop — Gemini timeouts observed
 * in practice are intermittent (transient latency), so one retry recovers
 * most of them without meaningfully slowing down the common case.
 */
export async function generateJsonFromPdf(
  pdfBuffer: Buffer,
  prompt: string,
  systemInstruction: string,
): Promise<string> {
  try {
    return await generateJsonFromPdfOnce(pdfBuffer, prompt, systemInstruction, GEMINI_DOCUMENT_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof GeminiTimeoutError) {
      console.warn(
        `Gemini timed out after ${GEMINI_DOCUMENT_TIMEOUT_MS}ms on first attempt; retrying once with a ${GEMINI_RETRY_TIMEOUT_MS}ms timeout.`,
      );
      return await generateJsonFromPdfOnce(pdfBuffer, prompt, systemInstruction, GEMINI_RETRY_TIMEOUT_MS);
    }
    throw error;
  }
}

export function assertValidPdfBuffer(fileBuffer: Buffer): void {
  if (fileBuffer.length < 5) {
    throw new Error('The uploaded file is not a valid PDF');
  }

  const header = fileBuffer.subarray(0, 5).toString('ascii');
  if (!header.startsWith('%PDF-')) {
    throw new Error('The uploaded file is not a valid PDF');
  }
}