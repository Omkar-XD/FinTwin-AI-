import { Hono } from 'hono';
import {
  getDashboardCache,
  setDashboardCache,
} from '../lib/dashboard-cache.js';
import type { AppBindings } from '../lib/auth.js';
import { getSupabase } from '../lib/supabase.js';
import { errorResponse, messageFromError } from '../lib/http-error.js';

export const dashboardRoutes = new Hono<AppBindings>();

dashboardRoutes.get('/:userId', async (c) => {
  try {
    const requestedUserId = c.req.param('userId');
    const userId = c.get('userId');

    if (requestedUserId !== userId) {
      return errorResponse(c, 403, 'Forbidden', 'FORBIDDEN');
    }

    if (!userId.trim()) {
      return errorResponse(c, 400, 'userId is required', 'BAD_REQUEST');
    }

    const cached = await getDashboardCache(userId);
    if (cached) {
      return c.json(JSON.parse(cached));
    }

    const supabase = getSupabase();

    const [profileResult, riskResult, recommendationsResult] = await Promise.all([
      supabase
        .from('financial_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('risk_scores')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(4),
    ]);

    if (profileResult.error) {
      console.error('Failed to fetch financial profile:', profileResult.error);
      return errorResponse(c, 500, 'Failed to fetch financial profile', 'INTERNAL_ERROR');
    }

    if (riskResult.error) {
      console.error('Failed to fetch risk scores:', riskResult.error);
      return errorResponse(c, 500, 'Failed to fetch risk scores', 'INTERNAL_ERROR');
    }

    if (recommendationsResult.error) {
      console.error('Failed to fetch recommendations:', recommendationsResult.error);
      return errorResponse(c, 500, 'Failed to fetch recommendations', 'INTERNAL_ERROR');
    }

    const payload = {
      userId,
      financialProfile: profileResult.data,
      riskScore: riskResult.data,
      recommendations: recommendationsResult.data ?? [],
    };

    await setDashboardCache(userId, JSON.stringify(payload));

    return c.json(payload);
  } catch (error) {
    console.error('Dashboard route failed:', error);
    return errorResponse(c, 500, messageFromError(error, 'Failed to load dashboard'), 'INTERNAL_ERROR');
  }
});
