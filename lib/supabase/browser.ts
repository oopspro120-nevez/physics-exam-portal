'use client';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
// Browser chỉ dùng signed upload. Không lưu access/refresh token trong localStorage.
export function uploadClient() {
  const { url, key } = publicEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
