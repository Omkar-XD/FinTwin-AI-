'use client';

import { motion } from 'framer-motion';
import { Check, Clock3, Sparkles, X } from 'lucide-react';
import {
  useDashboardData,
  usePendingRecommendations,
  useReviewRecommendation,
} from '@/lib/hooks';
import { useAuthStore } from '@/lib/store';

export function WelcomeSummary() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError } = useDashboardData(user?.id);
  const pendingRecommendations = usePendingRecommendations(user?.id);
  const reviewRecommendation = useReviewRecommendation(user?.id);
  const profile = data?.financialProfile;
  const displayName = user?.name?.trim();
  const greeting = displayName ? `Hi ${displayName}!` : 'Hi there!';
  const message = isLoading
    ? 'Loading your latest financial profile...'
    : isError
      ? 'I could not load your financial profile. You can still ask a question below.'
      : profile
        ? `${greeting}

Your latest financial profile is ready.

Income: ${profile.monthly_income ?? 'Unavailable'}
Expenses: ${profile.monthly_expenses ?? 'Unavailable'}
Savings: ${profile.savings ?? 'Unavailable'}
Health Score: ${profile.health_score ?? 'Unavailable'}
Debt: ${profile.total_debt ?? 'Unavailable'}
Cash Flow: ${profile.cash_flow ?? 'Unavailable'}

What would you like to explore?`
        : 'Your financial profile is not available yet. Upload a document to begin.';

  const pendingItems = pendingRecommendations.data ?? [];
  const showPendingReview =
    pendingRecommendations.isLoading ||
    pendingRecommendations.isError ||
    pendingItems.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-secondary/50 border border-border/40 rounded-2xl p-6 backdrop-blur-sm"
    >
      <div className="flex gap-4">
        {/* AI Avatar */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0"
        >
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </motion.div>

        {/* Message Content */}
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="prose prose-invert max-w-none text-foreground"
          >
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.split('\n').map((line, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + idx * 0.05 }}
                >
                  {line}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {showPendingReview && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="mb-3 flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-200" />
            <div>
              <h3 className="text-sm font-semibold text-amber-200">
              Pending Review
              </h3>
              <p className="text-xs text-muted-foreground">
                These recommendations were flagged by validation and need approval
                before they appear on your dashboard.
              </p>
            </div>
          </div>

          {pendingRecommendations.isLoading && (
            <p className="text-sm text-muted-foreground">
              Checking for recommendations that need review...
            </p>
          )}

          {pendingRecommendations.isError && (
            <p className="text-sm text-destructive">
              Pending recommendations could not be loaded.
            </p>
          )}

          {pendingItems.length > 0 && (
            <div className="space-y-3">
              {pendingItems.map((recommendation) => (
              <div
                key={recommendation.id}
                className="rounded-lg border border-border/40 bg-background/60 p-3"
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {recommendation.content ?? 'No recommendation content available.'}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={reviewRecommendation.isPending}
                    onClick={() =>
                      reviewRecommendation.mutate({
                        recommendationId: recommendation.id,
                        action: 'approve',
                      })
                    }
                    aria-label="Approve recommendation"
                    title="Approve recommendation"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={reviewRecommendation.isPending}
                    onClick={() =>
                      reviewRecommendation.mutate({
                        recommendationId: recommendation.id,
                        action: 'reject',
                      })
                    }
                    aria-label="Reject recommendation"
                    title="Reject recommendation"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/50 text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              ))}
            </div>
          )}

          {reviewRecommendation.isError && (
            <p className="mt-3 text-sm text-destructive">
              Review action failed. Please try again.
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
