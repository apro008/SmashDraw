'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '~/lib/auth';
import { supabaseAdmin } from '~/lib/supabaseAdmin';
import { SKILL_LEVELS, USER_ROLES, type SkillLevel, type UserRole } from '~/types';
import { fail, ok, type ActionResult, type FormState } from '../tournaments/[id]/state';

/**
 * Profile and account management. The app's policies only ever let someone
 * update their own row, so every action here is out of reach of the phone.
 */

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value.length > 0 ? value : null;
}

function integer(formData: FormData, key: string) {
  const value = text(formData, key);
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRole(value: string): value is UserRole {
  return (USER_ROLES as string[]).includes(value);
}

export async function setUserRole(userId: string, role: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!isRole(role)) return fail(`Unknown role: ${role}`);

  // Losing the last admin would lock everyone out of this panel, and the only
  // way back in is the promote-admin script on someone's laptop.
  if (userId === admin.id && role !== 'admin') {
    return fail('You cannot remove your own admin role from here.');
  }

  const { error } = await supabaseAdmin().from('profiles').update({ role }).eq('id', userId);
  if (error) return fail(error.message);

  revalidatePath('/players');
  return ok(`Role changed to ${role}.`);
}

export async function updateProfile(
  userId: string,
  prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const name = text(formData, 'name');
  if (!name) return { ...fail('A name is required.'), version: prev.version };

  const skillLevel = String(formData.get('skill_level') ?? 'beginner');
  const gender = text(formData, 'gender');

  const { error } = await supabaseAdmin()
    .from('profiles')
    .update({
      name,
      email: text(formData, 'email'),
      phone: text(formData, 'phone'),
      city: text(formData, 'city'),
      state: text(formData, 'state'),
      club_name: text(formData, 'club_name'),
      age: integer(formData, 'age'),
      gender,
      skill_level: (SKILL_LEVELS as string[]).includes(skillLevel)
        ? (skillLevel as SkillLevel)
        : 'beginner',
      ranking_points: integer(formData, 'ranking_points') ?? 0,
      tournaments_played: integer(formData, 'tournaments_played') ?? 0,
      tournaments_won: integer(formData, 'tournaments_won') ?? 0,
      avatar_url: text(formData, 'avatar_url'),
    })
    .eq('id', userId);

  if (error) return { ...fail(error.message), version: prev.version };

  revalidatePath('/players');
  return { ok: true, message: `${name} saved.`, version: prev.version + 1 };
}

/**
 * Sets a login password on an account. Needed for anyone who signed up through
 * Google and has none — including the admins of this panel, since login here is
 * email and password.
 */
export async function setUserPassword(userId: string, password: string): Promise<ActionResult> {
  await requireAdmin();

  if (password.length < 8) return fail('Use at least 8 characters.');

  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, { password });
  if (error) return fail(error.message);

  return ok('Password set.');
}

/**
 * Deletes the auth user. `profiles` cascades from `auth.users`, and their
 * registrations and notifications cascade from that.
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (userId === admin.id) return fail('You cannot delete your own account from here.');

  const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);
  if (error) return fail(error.message);

  revalidatePath('/players');
  return ok('Account deleted.');
}
