'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

import type { DocumentStatus } from './document-status';

export type { DocumentStatus };

export type ScenarioType =
  | 'vehicle_purchase'
  | 'new_loan'
  | 'increase_investments'
  | 'salary_change'
  | 'increase_savings'
  | 'early_loan_repayment';

export interface FinancialProfile {
  id: string;
  user_id: string;
  monthly_income: number | null;
  monthly_expenses: number | null;
  cash_flow: number | null;
  savings: number | null;
  total_debt: number | null;
  net_worth: number | null;
  health_score: number | null;
}

export interface RiskScore {
  risk_score: number | null;
  risk_factors: unknown;
  debt_to_income: number | null;
  credit_utilization: number | null;
  savings_adequacy: string | null;
  cash_flow_status: string | null;
}

export interface DashboardData {
  userId: string;
  financialProfile: FinancialProfile | null;
  riskScore: RiskScore | null;
  recommendations: Recommendation[];
}

export interface Recommendation {
  id: string;
  user_id: string;
  content: string | null;
  status?: string | null;
  enkrypt_status?: string | null;
  created_at?: string | null;
}

export function useDashboardData(userId?: string) {
  return useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => apiFetch<DashboardData>(`/dashboard/${userId}`),
    enabled: Boolean(userId),
  });
}

export function usePendingRecommendations(userId?: string) {
  return useQuery({
    queryKey: ['recommendations', 'pending', userId],
    queryFn: () =>
      apiFetch<{ recommendations: Recommendation[] }>(
        `/recommendations/pending/${userId}`,
      ),
    select: (data) => data.recommendations,
    enabled: Boolean(userId),
  });
}

export function useReviewRecommendation(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recommendationId,
      action,
    }: {
      recommendationId: string;
      action: 'approve' | 'reject';
    }) =>
      apiFetch<{ recommendation: Recommendation }>(
        `/recommendations/${recommendationId}/${action}`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
      void queryClient.invalidateQueries({
        queryKey: ['recommendations', 'pending', userId],
      });
    },
  });
}

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () =>
      apiFetch<{ financialProfile: FinancialProfile | null }>(`/profile/${userId}`),
    select: (data) => data.financialProfile,
    enabled: Boolean(userId),
  });
}

export function useRiskScore(userId?: string) {
  return useDashboardData(userId);
}

export function useDocuments() {
  const queryClient = useQueryClient();
  const documentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: () =>
      apiFetch<{ documents: Array<Record<string, unknown>> }>('/documents'),
    select: (data) => data.documents,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, docType }: { file: File; docType: string }) => {
      const body = new FormData();
      body.append('file', file);
      body.append('docType', docType);
      return apiFetch<{ documentId: string; status: DocumentStatus }>(
        '/documents/upload',
        { method: 'POST', body },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  return { documentsQuery, uploadMutation };
}

export function useAnalyzeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      apiFetch<{ documentId: string; status: DocumentStatus }>(
        `/documents/${documentId}/analyze`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDocumentStatus(documentId?: string) {
  return useQuery({
    queryKey: ['document-status', documentId],
    queryFn: () =>
      apiFetch<{ documentId: string; status: DocumentStatus }>(
        `/documents/${documentId}/status`,
      ),
    enabled: Boolean(documentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 2_000;
    },
  });
}

export function useSimulation() {
  return useMutation({
    mutationFn: ({
      userId,
      scenarioType,
      params = {},
    }: {
      userId: string;
      scenarioType: ScenarioType;
      params?: Record<string, unknown>;
    }) =>
      apiFetch<{ projectedOutcome: Record<string, unknown> }>('/simulation/run', {
        method: 'POST',
        body: JSON.stringify({ userId, scenarioType, params }),
      }),
  });
}

export function useAssistantChat() {
  return useMutation({
    mutationFn: ({ userId, message }: { userId: string; message: string }) =>
      apiFetch<{ answer: string }>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ userId, message }),
      }),
  });
}
