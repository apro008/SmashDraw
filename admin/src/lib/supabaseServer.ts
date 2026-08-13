import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * Session-bound client, anon key only. Used purely to sign in, sign out, and ask
 * who the current visitor is. All privileged reads and writes go through
 * `supabaseAdmin()` instead.
 */
export async function supabaseSession() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a server component, where cookies are read-only. The
          // middleware refreshes the session, so this is safe to swallow.
        }
      },
    },
  });
}
