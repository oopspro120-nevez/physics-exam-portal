import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env';
import { cache } from 'react';
import { sessionCookieOptions } from '@/lib/session';
export const serverClient = cache(async () => {
  const jar = await cookies();
  const { url, key } = publicEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, {
              ...sessionCookieOptions(options),
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            }),
          );
        } catch {
          /* Server Components refresh through proxy. */
        }
      },
    },
  });
});
