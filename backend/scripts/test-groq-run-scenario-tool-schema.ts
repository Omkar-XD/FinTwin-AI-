import { config } from 'dotenv';
import { applyCompatLayer, MetaSchemaCompatLayer } from '@mastra/schema-compat';
import { runScenarioSimulationTool } from '../src/agents/assistant-agent.js';
import { GROQ_CHAT_MODEL } from '../src/lib/models.js';

config();

const apiKey = process.env['GROQ_API_KEY'];
if (!apiKey) {
  throw new Error('Missing GROQ_API_KEY');
}

const model = GROQ_CHAT_MODEL.replace(/^groq\//, '');
const parameters = applyCompatLayer({
  schema: runScenarioSimulationTool.inputSchema,
  compatLayers: [new MetaSchemaCompatLayer({ provider: 'groq', modelId: GROQ_CHAT_MODEL })],
  mode: 'jsonSchema',
});

const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${apiKey.trim()}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Call runScenarioSimulation. Include params with all 11 keys. Use null for unused fields.',
      },
      {
        role: 'user',
        content:
          'Run an increase_savings scenario with savingsIncreasePercent 60, monthlyIncome 70986.83, monthlyExpenses 69291.02, and savings 116149.46.',
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'runScenarioSimulation',
          description: runScenarioSimulationTool.description,
          parameters,
        },
      },
    ],
    tool_choice: {
      type: 'function',
      function: { name: 'runScenarioSimulation' },
    },
  }),
});

const text = await response.text();
console.log(`Groq status: ${response.status} ${response.statusText}`);
console.log(text);

if (!response.ok) {
  process.exitCode = 1;
}
