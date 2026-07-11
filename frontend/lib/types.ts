export type { DocumentStatus } from '@/lib/document-status';
import type { DocumentStatus } from '@/lib/document-status';
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: 'bank_statement' | 'salary_slip' | 'credit_card' | 'loan_statement';
  uploadedAt: Date;
  size: number;
  status: DocumentStatus;
}

export interface ChatAttachment {
  id: string;
  documentId: string;
  name: string;
  size: number;
  status: DocumentStatus;
}

// Chat & Conversation
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    agentSteps?: AgentStep[];
    attachments?: ChatAttachment[];
  };
}

export interface AgentStep {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
  timestamp?: Date;
}

// Financial Data
export interface FinancialSummary {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  healthScore: number;
  totalDebt: number;
  monthlyDebtPayment: number;
}

export interface RiskMetrics {
  overallRisk: number; // 0-100
  riskScore: string;
  recommendations: string[];
}

export interface QuickInsight {
  id: string;
  type: 'snapshot' | 'risk' | 'recommendation' | 'document' | 'scenario';
  title: string;
  description: string;
  data?: any;
}

// Scenario Simulation
export interface ScenarioOption {
  id: string;
  name: string;
  description: string;
}

export interface SimulationResult {
  scenario: string;
  projectedImpact: {
    monthlyPayment?: number;
    newNetWorth?: number;
    savingsGain?: number;
  };
  risks: string[];
  recommendation: string;
}

// Workspace State
export interface WorkspaceSession {
  id: string;
  userId: string;
  documentsProcessed: string[];
  conversationHistory: ChatMessage[];
  currentSummary: FinancialSummary;
  createdAt: Date;
}
