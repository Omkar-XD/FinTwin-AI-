import { Mastra } from '@mastra/core/mastra';
import { assistantAgent } from './assistant-agent.js';
import { financialProfileAgent } from './financial-profile-agent.js';
import { recommendationAgent } from './recommendation-agent.js';
import { riskDetectionAgent } from './risk-detection-agent.js';
import { scenarioSimulationAgent } from './scenario-simulation-agent.js';
import { financialIntakeWorkflow } from '../workflows/financial-intake-workflow.js';

/**
 * Central Mastra instance for agent orchestration.
 * Register agents here as they are implemented.
 */
export const mastra = new Mastra({
  agents: {
    financialProfileAgent,
    riskDetectionAgent,
    recommendationAgent,
    scenarioSimulationAgent,
    assistantAgent,
  },
  workflows: {
    'financial-intake-workflow': financialIntakeWorkflow,
  },
});
