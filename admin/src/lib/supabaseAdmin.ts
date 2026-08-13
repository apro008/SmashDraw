import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { serviceRoleKey, supabaseUrl } from './env';

/**
 * The unrestricted client. It authenticates with the service role key, so every
 * row level security policy is bypassed — this is what lets an admin edit any
 * registration in any tournament, delete a real player's entry, or move someone
 * between categories, none of which the app's policies allow.
 *
 * Because RLS is off, *this module is the security boundary*. Never call it from
 * a route that has not gone through `requireAdmin()` first. The `server-only`
 * import above makes bundling it into client code fail at build time.
 *
 * Note it is not tied to a signed-in user, so `auth.uid()` is null inside
 * Postgres. Any RPC that checks `auth.uid()` (add_tournament_entry,
 * remove_tournament_entry, notify_draw_published) will reject it — that is why
 * the actions here write to the tables directly instead.
 */
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl(), serviceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
