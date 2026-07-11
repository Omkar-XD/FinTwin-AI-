import { Hono } from 'hono';
import type { AppBindings } from '../lib/auth.js';
import { errorResponse, messageFromError } from '../lib/http-error.js';
import { getSupabase } from '../lib/supabase.js';

export const profileRoutes = new Hono<AppBindings>();

profileRoutes.get('/:userId', async (c) => {
  try {
    const requestedUserId = c.req.param('userId');
    const userId = c.get('userId');

    if (requestedUserId !== userId) {
      return errorResponse(c, 403, 'Forbidden', 'FORBIDDEN');
    }

    const { data, error } = await getSupabase()
      .from('financial_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch financial profile:', error);
      return errorResponse(c, 500, 'Failed to fetch financial profile', 'INTERNAL_ERROR');
    }

    return c.json({ financialProfile: data });
  } catch (error) {
    console.error('Profile route failed:', error);
    return errorResponse(c, 500, messageFromError(error, 'Failed to fetch financial profile'), 'INTERNAL_ERROR');
  }
});
