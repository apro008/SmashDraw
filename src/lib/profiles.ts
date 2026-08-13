import { supabase } from '~/lib/supabase';
import { UserProfile } from '~/types';

/**
 * Every account, newest first. The "Users can view all profiles" policy makes
 * this readable with the normal anon client — no service role needed.
 */
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as UserProfile[]) ?? [];
}

/** Head-only count, for dashboards that need the number but not the rows. */
export async function fetchProfileCount() {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  if (error) throw error;
  return count ?? 0;
}
