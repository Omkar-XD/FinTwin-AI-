import { env } from './env.js';

type GeminiEmbedContentResponse = {
  embedding?: {
    values?: number[];
  };
};

const GEMINI_EMBED_TIMEOUT_MS = 30_000;

function getEmbeddingEndpoint(): string {
  const model = encodeURIComponent(env.geminiEmbeddingModel);
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(env.googleGenerativeAiApiKey)}`;
}

export async function embedText(text: string): Promise<number[]> {
  if (!env.googleGenerativeAiApiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY must be set for Gemini embeddings');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Cannot embed empty text');
  }

  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    const response = await Promise.race([
      fetch(getEmbeddingEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: trimmed }],
          },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: env.geminiEmbeddingDimensions,
        }),
      }),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`Gemini embedding request timed out after ${GEMINI_EMBED_TIMEOUT_MS}ms`)),
          GEMINI_EMBED_TIMEOUT_MS,
        );
      }),
    ]);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Gemini embedding request failed with status ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
      );
    }

    const payload = (await response.json()) as GeminiEmbedContentResponse;
    const embedding = payload.embedding?.values;

    if (!embedding?.length) {
      throw new Error('Gemini embedding response did not contain a vector');
    }

    if (embedding.length !== env.geminiEmbeddingDimensions) {
      throw new Error(
        `Gemini embedding dimension mismatch: expected ${env.geminiEmbeddingDimensions}, received ${embedding.length}`,
      );
    }

    return embedding;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function getConfiguredEmbeddingDimensions(): number {
  return env.geminiEmbeddingDimensions;
}
