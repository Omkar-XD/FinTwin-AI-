'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
// ^ Adjust the import path if your actual file lives somewhere other than
//   frontend/lib/supabase.ts — this matches the `getSupabaseBrowserClient`
//   export from that file.

type RecommendationStatus = 'pending_review' | 'approved' | 'rejected';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  status: RecommendationStatus;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onStatusChange: (id: string, status: RecommendationStatus) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function RecommendationCard({ recommendation, onStatusChange }: RecommendationCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: 'approve' | 'reject') {
    setIsSubmitting(true);
    setError(null);

    // Optimistic update — flip the UI immediately, roll back on failure.
    const nextStatus: RecommendationStatus = action === 'approve' ? 'approved' : 'rejected';
    onStatusChange(recommendation.id, nextStatus);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`${API_URL}/recommendations/${recommendation.id}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to ${action} recommendation`);
      }
    } catch (err) {
      // Roll back the optimistic update on failure.
      onStatusChange(recommendation.id, 'pending_review');
      setError(err instanceof Error ? err.message : `Failed to ${action} recommendation`);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (recommendation.status !== 'pending_review') {
    // Already actioned — show a quiet resolved state instead of buttons.
    return (
      <div className="rounded-lg border border-neutral-200 p-4 opacity-60">
        <p className="text-sm font-medium">{recommendation.title}</p>
        <p className="mt-1 text-xs text-neutral-500">
          {recommendation.status === 'approved' ? 'Approved' : 'Rejected'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{recommendation.title}</p>
          {recommendation.priority && (
            <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {recommendation.priority} priority
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-neutral-600">{recommendation.description}</p>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction('approve')}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleAction('reject')}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
