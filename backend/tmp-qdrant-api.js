import { QdrantClient } from '@qdrant/js-client-rest';
const client = new QdrantClient({ url: 'http://localhost:6333', checkCompatibility: false });
const api = client.api();
console.log(Object.keys(api).filter((key) => key.toLowerCase().includes('upsert') || key.toLowerCase().includes('point') || key.toLowerCase().includes('search') || key.toLowerCase().includes('vector') || key.toLowerCase().includes('query')).sort());
