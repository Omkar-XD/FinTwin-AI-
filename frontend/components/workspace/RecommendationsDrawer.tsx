'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { apiFetch } from '@/lib/api';

interface RecommendationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Recommendation {
  id: string;
  content: string;
  status: string;
  enkrypt_status: string;
  created_at: string;
}

export function RecommendationsDrawer({ isOpen, onClose }: RecommendationsDrawerProps) {
  const user = useAuthStore((state) => state.user);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ recommendations: Recommendation[] }>(
        `/recommendations/pending/${user.id}`,
      );
      setRecommendations(data.recommendations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      fetchRecommendations();
    }
  }, [isOpen, fetchRecommendations]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActioningId(id);
    try {
      await apiFetch(`/recommendations/${id}/${action}`, { method: 'POST' });
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          <motion.div
            initial={{ x: 500, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 500, opacity: 0 }}
            transition={{ type: 'spring', damping: 30 }}
            className="fixed right-0 top-0 h-screen w-full max-w-md bg-background border-l border-border/40 z-50 flex flex-col overflow-hidden"
          >
            <div className="border-b border-border/40 p-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">AI Recommendations</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading recommendations...</p>
              ) : error ? (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <Lightbulb className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No pending recommendations right now.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Review and approve or reject each recommendation:
                  </p>

                  {recommendations.map((rec, idx) => (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-secondary/40 border border-border/40 rounded-lg p-4 space-y-3"
                    >
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                        {rec.content}
                      </p>

                      {rec.enkrypt_status === 'flagged' && (
                        <p className="text-xs text-destructive">
                          ⚠ Flagged for review by safety validation
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleAction(rec.id, 'approve')}
                          disabled={actioningId === rec.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(rec.id, 'reject')}
                          disabled={actioningId === rec.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border/40 p-6">
              <button
                onClick={onClose}
                className="w-full px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
