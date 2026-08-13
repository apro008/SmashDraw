'use server';

import { redirect } from 'next/navigation';

import { supabaseAdmin } from '~/lib/supabaseAdmin';
import { supabaseSession } from '~/lib/supabaseServer';
import type { UserProfile } from '~/types';

export interface LoginState {
  error: string | null;
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }

  const supabase = await supabaseSession();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: error?.message ?? 'Could not sign in.' };
  }

  const { data: profile } = await supabaseAdmin()
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle<Pick<UserProfile, 'role'>>();

  // A valid password is not enough — the panel is admins only, so anyone else
  // gets signed straight back out rather than left holding a session.
  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    return { error: 'That account is not an admin.' };
  }

  redirect('/tournaments');
}

export async function signOut() {
  const supabase = await supabaseSession();
  await supabase.auth.signOut();
  redirect('/login');
}
