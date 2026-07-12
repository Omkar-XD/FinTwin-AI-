import { Hono } from 'hono';
import type { AppBindings } from '../lib/auth.js';
import { getSupabase } from '../lib/supabase.js';
import { invalidateDashboardCache } from '../lib/dashboard-cache.js';
import { errorResponse, messageFromError } from '../lib/http-error.js';
import { randomUUID } from 'node:crypto';
import { embedText, ensureCollectionAndUpsert, getQdrant } from '../lib/qdrant.js';

export const recommendationRoutes = new Hono<AppBindings>();

recommendationRoutes.get('/pending/:userId', async (c) => {
  try {
    const requestedUserId = c.req.param('userId');
    const userId = c.get('userId');

    if (requestedUserId !== userId) {
      return errorResponse(c, 403, 'Forbidden', 'FORBIDDEN');
    }

    const { data, error } = await getSupabase()
      .from('recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch pending recommendations:', error);
      return errorResponse(c, 500, 'Failed to fetch pending recommendations', 'INTERNAL_ERROR');
    }

    return c.json({ recommendations: data ?? [] });
  } catch (error) {
    console.error('Pending recommendations route failed:', error);
    return errorResponse(c, 500, messageFromError(error, 'Failed to fetch pending recommendations'), 'INTERNAL_ERROR');
  }
});

recommendationRoutes.post('/:id/approve', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const { data, error } = await getSupabase()
      .from('recommendations')
      .update({ status: 'approved' })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, user_id, status')
      .maybeSingle();

    if (error) {
      console.error('Failed to approve recommendation:', error);
      return errorResponse(c, 500, 'Failed to approve recommendation', 'INTERNAL_ERROR');
    }

    if (!data) {
      return errorResponse(c, 404, 'Recommendation not found', 'NOT_FOUND');
    }

    await invalidateDashboardCache(userId);
    return c.json({ recommendation: data });
  } catch (error) {
    console.error('Approve recommendation route failed:', error);
    return errorResponse(c, 500, messageFromError(error, 'Failed to approve recommendation'), 'INTERNAL_ERROR');
  }
});

recommendationRoutes.post('/:id/reject', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('userId');

    const { data, error } = await getSupabase()
      .from('recommendations')
      .update({ status: 'rejected' })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id, user_id, status, content')
      .maybeSingle();

    if (error) {
      console.error('Failed to reject recommendation:', error);
      return errorResponse(c, 500, 'Failed to reject recommendation', 'INTERNAL_ERROR');
    }

    if (!data) {
      return errorResponse(c, 404, 'Recommendation not found', 'NOT_FOUND');
    }

    // NEW: record the rejection as feedback memory so future recommendation
    // generation avoids repeating content the user already declined.
    try {
      const feedbackSummary = `User rejected this recommendation: ${data.content}`;
      const vector = await embedText(feedbackSummary);
      await ensureCollectionAndUpsert(
        getQdrant(),
        userId,
        vector,
        {
          userId,
          type: 'recommendation_feedback',
          feedbackType: 'rejected',
          recommendationId: id,
          summary: feedbackSummary,
          timestamp: new Date().toISOString(),
        },
        randomUUID(),
      );
    } catch (feedbackError) {
      console.error('Failed to store rejection feedback; continuing:', feedbackError);
    }

    await invalidateDashboardCache(userId);
    return c.json({ recommendation: data });
  } catch (error) {
    console.error('Reject recommendation route failed:', error);
    return errorResponse(c, 500, messageFromError(error, 'Failed to reject recommendation'), 'INTERNAL_ERROR');
  }
});
