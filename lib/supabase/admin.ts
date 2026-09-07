import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
export function adminClient() {
  const { url } = publicEnv();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('SETUP_REQUIRED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
