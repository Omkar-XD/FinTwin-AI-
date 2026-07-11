import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';
import { env } from './env.js';

let supabase: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    supabase = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey);
  }
  return supabase;
}

export const DOCUMENTS_BUCKET = 'documents';
