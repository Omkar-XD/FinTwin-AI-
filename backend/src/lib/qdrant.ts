import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from './env.js';
import { embedText, getConfiguredEmbeddingDimensions } from './gemini-embeddings.js';

const USER_FINANCIAL_MEMORY_COLLECTION = 'user_financial_memory';
const RECOMMENDATION_FEEDBACK_COLLECTION = 'recommendation_feedback';

let qdrant: QdrantClient | null = null;

export function getQdrant(): QdrantClient {
  if (!qdrant) {
    qdrant = new QdrantClient({
      url: env.qdrantUrl,
      apiKey: env.qdrantApiKey || undefined,
      checkCompatibility: false,
    });
  }
  return qdrant;
}

export { embedText };

async function ensureCollection(
  client: QdrantClient,
  vectorSize: number,
): Promise<void> {
  const api = client.api();
  try {
    await api.getCollection({ collection_name: USER_FINANCIAL_MEMORY_COLLECTION });
  } catch {
    await api.createCollection({
      collection_name: USER_FINANCIAL_MEMORY_COLLECTION,
      vectors: {
        size: vectorSize || getConfiguredEmbeddingDimensions(),
        distance: 'Cosine',
      },
    });
    try {
      await api.createFieldIndex({
        collection_name: USER_FINANCIAL_MEMORY_COLLECTION,
        field_name: 'userId',
        field_schema: 'keyword',
      });
      await api.createFieldIndex({
        collection_name: USER_FINANCIAL_MEMORY_COLLECTION,
        field_name: 'type',
        field_schema: 'keyword',
      });
    } catch (indexError) {
      console.error('Failed to create payload indexes during collection setup:', indexError);
    }
  }
}

export async function ensureCollectionAndUpsert(
  client: QdrantClient,
  userId: string,
  vector: number[],
  payload: Record<string, unknown>,
  pointId = `user:${userId}:profile_snapshot`,
): Promise<void> {
  try {
    const api = client.api();
    await ensureCollection(client, vector.length);
    await api.upsertPoints({
      collection_name: USER_FINANCIAL_MEMORY_COLLECTION,
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload,
        },
      ],
    });
  } catch (error) {
    console.error('Qdrant upsert failed; continuing without persisted memory:', error);
  }
}

export async function upsertMemoryPoint(
  pointId: string,
  vector: number[],
  payload: Record<string, unknown>,
): Promise<void> {
  const client = getQdrant();
  await ensureCollectionAndUpsert(client, String(payload['userId'] ?? ''), vector, payload, pointId);
}

export async function upsertMemory(
  userId: string,
  summary: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const client = getQdrant();
    const vector = await embedText(summary);
    await ensureCollectionAndUpsert(client, userId, vector, metadata);
  } catch (error) {
    console.error('Qdrant memory upsert failed; continuing without persisted memory:', error);
  }
}

type RetrieveMemoryOptions = {
  type?: string;
  limit?: number;
};

export async function retrieveMemory(
  userId: string,
  query: string,
  options: RetrieveMemoryOptions = {},
): Promise<Record<string, unknown>[]> {
  try {
    const client = getQdrant();
    const vector = await embedText(query);
    const mustFilters: Array<Record<string, unknown>> = [
      {
        key: 'userId',
        match: {
          value: userId,
        },
      },
    ];
    if (options.type) {
      mustFilters.push({
        key: 'type',
        match: {
          value: options.type,
        },
      });
    }
    const results = await client.api().searchPoints({
      collection_name: USER_FINANCIAL_MEMORY_COLLECTION,
      vector,
      filter: {
        must: mustFilters,
      },
      limit: options.limit ?? 5,
      with_payload: true,
    });
    return (results.data?.result ?? []).map((point) => ({
      ...(point.payload ?? {}),
      score: point.score,
    })) as Record<string, unknown>[];
  } catch (error) {
    console.error('Qdrant retrieve failed; continuing without memory context:', error);
    return [];
  }
}

// --- Cross-user recommendation feedback --------------------------------
// Deliberately a SEPARATE collection from user_financial_memory, and
// deliberately never filtered by userId on read. The point is that user A
// rejecting a recommendation should influence what user B is generated next
// — this is a shared, system-wide feedback signal, not personal memory.

async function ensureFeedbackCollection(
  client: QdrantClient,
  vectorSize: number,
): Promise<void> {
  const api = client.api();
  try {
    await api.getCollection({ collection_name: RECOMMENDATION_FEEDBACK_COLLECTION });
  } catch {
    await api.createCollection({
      collection_name: RECOMMENDATION_FEEDBACK_COLLECTION,
      vectors: {
        size: vectorSize || getConfiguredEmbeddingDimensions(),
        distance: 'Cosine',
      },
    });
    try {
      await api.createFieldIndex({
        collection_name: RECOMMENDATION_FEEDBACK_COLLECTION,
        field_name: 'outcome',
        field_schema: 'keyword',
      });
    } catch (indexError) {
      console.error('Failed to create payload index on recommendation_feedback:', indexError);
    }
  }
}

export async function recordRecommendationFeedback(
  recommendationId: string,
  content: string,
  outcome: 'approved' | 'rejected',
): Promise<void> {
  try {
    const client = getQdrant();
    const vector = await embedText(content);
    await ensureFeedbackCollection(client, vector.length);
    await client.api().upsertPoints({
      collection_name: RECOMMENDATION_FEEDBACK_COLLECTION,
      wait: true,
      points: [
        {
          id: `feedback:${recommendationId}`,
          vector,
          payload: {
            content,
            outcome,
            recommendationId,
            timestamp: new Date().toISOString(),
          },
        },
      ],
    });
  } catch (error) {
    console.error('Failed to record recommendation feedback; continuing without it:', error);
  }
}

export async function retrieveRecommendationFeedbackExamples(
  queryText: string,
  outcome: 'approved' | 'rejected',
  limit = 3,
): Promise<{ content: string; timestamp: string }[]> {
  try {
    const client = getQdrant();
    const vector = await embedText(queryText);
    await ensureFeedbackCollection(client, vector.length);
    const results = await client.api().searchPoints({
      collection_name: RECOMMENDATION_FEEDBACK_COLLECTION,
      vector,
      filter: {
        must: [{ key: 'outcome', match: { value: outcome } }],
      },
      limit,
      with_payload: true,
    });
    return (results.data?.result ?? []).map((point) => ({
      content: String(point.payload?.['content'] ?? ''),
      timestamp: String(point.payload?.['timestamp'] ?? ''),
    }));
  } catch (error) {
    console.error(`Failed to retrieve ${outcome} recommendation feedback; continuing without it:`, error);
    return [];
  }
}
