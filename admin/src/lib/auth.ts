import 'server-only';

import { redirect } from 'next/navigation';

import { supabaseAdmin } from './supabaseAdmin';
import { supabaseSession } from './supabaseServer';
import type { UserProfile } from '~/types';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

/** The signed-in admin, or null — for anything that must not redirect. */
export async function currentAdmin(): Promise<AdminUser | null> {
  const supabase = await supabaseSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Role comes from `profiles`, read with the service key so a missing select
  // policy can never make an admin look like a player.
  const { data } = await supabaseAdmin()
    .from('profiles')
    .select('id,name,role')
    .eq('id', user.id)
    .maybeSingle<Pick<UserProfile, 'id' | 'name' | 'role'>>();

  if (data?.role !== 'admin') return null;

  return { id: user.id, email: user.email ?? '', name: data.name };
}

/**
 * Gate for every privileged page and server action. Since the service role
 * client ignores RLS, this check is the only thing standing between a visitor
 * and the whole database — call it first, every time.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) redirect('/login');
  return admin;
}
