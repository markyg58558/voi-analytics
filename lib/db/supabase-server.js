import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/config/env';

let adminClient;

export function getSupabaseAdminClient() {
  if (adminClient) return adminClient;

  const env = getEnv();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('Supabase admin client is not configured');
  }

  adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });

  return adminClient;
}

export function getSupabaseAnonServerClient() {
  const env = getEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error('Supabase anon server client is not configured');
  }

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false }
  });
}
