'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { RecommendationCard } from './RecommendationCard';

type RecommendationStatus = 'pending_review' | 'approved' | 'rejected';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  status: RecommendationStatus;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export function RecommendationsList() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const userId = session.user.id;

      const res = await fetch(`${API_URL}/recommendations/pending/${userId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to load recommendations');
      }

      const data = await res.json();
      // Backend route returns { recommendations: [...] } with rows shaped
      // from Supabase — map to the fields RecommendationCard expects.
      const mapped: Recommendation[] = (data.recommendations ?? []).map((rec: any) => ({
        id: rec.id,
        title: rec.title ?? rec.content?.title ?? 'Recommendation',
        description: rec.description ?? rec.content?.description ?? rec.content ?? '',
        priority: rec.priority ?? rec.content?.priority,
        status: rec.status ?? 'pending_review',
      }));

      setRecommendations(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  function handleStatusChange(id: string, status: RecommendationStatus) {
    setRecommendations((prev) =>
      prev.map((rec) => (rec.id === id ? { ...rec, status } : rec)),
    );
  }

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Loading recommendations…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <button
          type="button"
          onClick={fetchRecommendations}
          className="ml-2 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const visible = recommendations.filter((rec) => rec.status === 'pending_review');

  if (visible.length === 0) {
    return <p className="text-sm text-neutral-500">No recommendations pending review.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {visible.map((rec) => (
        <RecommendationCard
          key={rec.id}
          recommendation={rec}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  );
}
