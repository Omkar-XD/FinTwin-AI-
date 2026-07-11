export const GROQ_CHAT_MODEL = 'groq/llama-3.3-70b-versatile';
export const GROQ_CHAT_MODEL_LABEL = 'llama-3.3-70b-versatile';

/** Default Gemini embedding model; override with GEMINI_EMBEDDING_MODEL. */
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
export const DEFAULT_GEMINI_EMBEDDING_DIMENSIONS = 768;

export const GEMINI_DOCUMENT_MODEL = 'gemini-2.5-flash';

export const GROQ_COMPLETION_TOKEN_BUDGET = 1024; // typical JSON/text completion size
export const GROQ_TOOL_LOOP_TOKEN_BUDGET = 1200;  // headroom for multi-turn tool-calling agents
