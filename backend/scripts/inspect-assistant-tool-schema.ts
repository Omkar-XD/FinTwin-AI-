import {
  applyCompatLayer,
  convertZodSchemaToAISDKSchema,
  MetaSchemaCompatLayer,
  prepareJsonSchemaForOpenAIStrictMode,
} from '@mastra/schema-compat';
import { runScenarioSimulationTool } from '../src/agents/assistant-agent.js';
import { GROQ_CHAT_MODEL } from '../src/lib/models.js';

const inputSchema = runScenarioSimulationTool.inputSchema;
const model = {
  provider: 'groq',
  modelId: GROQ_CHAT_MODEL,
};

function printSchema(label: string, schema: unknown): void {
  console.log(`\n========== ${label} ==========`);
  console.log(JSON.stringify(schema, null, 2));
}

const aiSdkSchema = convertZodSchemaToAISDKSchema(inputSchema);
printSchema('convertZodSchemaToAISDKSchema(inputSchema).jsonSchema', aiSdkSchema.jsonSchema);

const compatJsonSchema = applyCompatLayer({
  schema: inputSchema,
  compatLayers: [new MetaSchemaCompatLayer(model)],
  mode: 'jsonSchema',
});
printSchema('applyCompatLayer(... MetaSchemaCompatLayer, jsonSchema)', compatJsonSchema);

const compatAiSdkSchema = applyCompatLayer({
  schema: inputSchema,
  compatLayers: [new MetaSchemaCompatLayer(model)],
  mode: 'aiSdkSchema',
});
printSchema(
  'applyCompatLayer(... MetaSchemaCompatLayer, aiSdkSchema).jsonSchema',
  compatAiSdkSchema.jsonSchema,
);

printSchema(
  'prepareJsonSchemaForOpenAIStrictMode(Meta jsonSchema)',
  prepareJsonSchemaForOpenAIStrictMode(compatJsonSchema),
);
