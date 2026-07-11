import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getSupabase } from './supabase.js';

export type AppBindings = {
  Variables: {
    userId: string;
  };
};

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export const supabaseAuthMiddleware = createMiddleware<AppBindings>(
  async (c, next) => {
    const token = extractBearerToken(c.req.header('Authorization'));
    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    c.set('userId', data.user.id);
    await next();
  },
);

export async function getUserIdFromRequest(c: Context): Promise<string | null> {
  const contextUserId = c.get('userId');
  if (typeof contextUserId === 'string') {
    return contextUserId;
  }

  const token = extractBearerToken(c.req.header('Authorization'));
  if (!token) {
    return null;
  }

  const { data, error } = await getSupabase().auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}
