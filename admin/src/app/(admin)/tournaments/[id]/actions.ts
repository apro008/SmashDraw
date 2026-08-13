'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '~/lib/auth';
import { searchProfiles } from '~/lib/data';
import { parseNotes } from '~/lib/notes';
import { supabaseAdmin } from '~/lib/supabaseAdmin';
import {
  REGISTRATION_STATUSES,
  type PlayerSummary,
  type Registration,
  type RegistrationStatus,
} from '~/types';
import { fail, ok, type ActionResult, type FormState } from './state';

/**
 * Every action here runs as the service role, which ignores row level security.
 * That is the point — an admin can decline a walk-in an organizer added, move a
 * real player between categories, or delete an entry outright, none of which the
 * app's policies permit. It also means `requireAdmin()` on the first line is not
 * optional.
 */

function refresh(tournamentId: string) {
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath('/tournaments');
}

const FEATURES_SQL_HINT =
  'Run supabase/features.sql in the Supabase SQL editor first — it adds ' +
  'registrations.added_by and makes user_id nullable, which is what lets an ' +
  'entry be created by an admin or belong to a walk-in with no account.';

function readableError(error: { message: string; code?: string }) {
  if (error.code === '23505') {
    return 'That player already has an entry in this category.';
  }
  // 42703 = column does not exist, PGRST204 = column missing from the schema
  // cache, 23502 = not-null violation on user_id. All three mean the same thing.
  if (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (error.code === '23502' && error.message.includes('user_id'))
  ) {
    return `${error.message}. ${FEATURES_SQL_HINT}`;
  }
  return error.message;
}

function isStatus(value: string): value is RegistrationStatus {
  return (REGISTRATION_STATUSES as string[]).includes(value);
}

// ── Decisions ─────────────────────────────────────────────

export async function setEntryStatus(
  tournamentId: string,
  registrationId: string,
  status: string
): Promise<ActionResult> {
  await requireAdmin();

  if (!isStatus(status)) return fail(`Unknown status: ${status}`);

  const { error } = await supabaseAdmin()
    .from('registrations')
    .update({ status })
    .eq('id', registrationId);

  if (error) return fail(readableError(error));

  refresh(tournamentId);
  // The `on_registration_change_notify` trigger turns this into a push for the
  // player; walk-ins have no user_id, and create_notification no-ops on those.
  return ok(`Entry marked ${status}.`);
}

/** Applies one decision to many entries — the checkbox selection in the table. */
export async function setManyEntryStatuses(
  tournamentId: string,
  registrationIds: string[],
  status: string
): Promise<ActionResult> {
  await requireAdmin();

  if (!isStatus(status)) return fail(`Unknown status: ${status}`);
  if (registrationIds.length === 0) return fail('Nothing selected.');

  const { error } = await supabaseAdmin()
    .from('registrations')
    .update({ status })
    .in('id', registrationIds);

  if (error) return fail(readableError(error));

  refresh(tournamentId);
  return ok(`${registrationIds.length} entries marked ${status}.`);
}

// ── Category move ─────────────────────────────────────────

export async function moveEntryCategory(
  tournamentId: string,
  registrationId: string,
  categoryId: string
): Promise<ActionResult> {
  await requireAdmin();

  const db = supabaseAdmin();

  // Moving an entry into another tournament's category would silently corrupt
  // both rosters, so check the category belongs here first.
  const { data: category } = await db
    .from('tournament_categories')
    .select('id,name,tournament_id')
    .eq('id', categoryId)
    .maybeSingle<{ id: string; name: string; tournament_id: string }>();

  if (!category || category.tournament_id !== tournamentId) {
    return fail('That category does not belong to this tournament.');
  }

  const { error } = await db
    .from('registrations')
    .update({ category_id: categoryId })
    .eq('id', registrationId);

  if (error) return fail(readableError(error));

  refresh(tournamentId);
  return ok(`Moved to ${category.name}.`);
}

// ── Deletion ──────────────────────────────────────────────

/**
 * Deletes any entry, not just organizer-added ones — the `remove_tournament_entry`
 * RPC the app uses refuses rows with a null `added_by`, and it checks
 * `auth.uid()`, which is null for the service role. So this writes to the table.
 */
export async function deleteEntry(
  tournamentId: string,
  registrationId: string
): Promise<ActionResult> {
  await requireAdmin();

  const { error } = await supabaseAdmin()
    .from('registrations')
    .delete()
    .eq('id', registrationId);

  if (error) return fail(readableError(error));

  refresh(tournamentId);
  return ok('Entry deleted.');
}

// ── Creating an entry ─────────────────────────────────────

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value.length > 0 ? value : null;
}

/**
 * Builds the `notes` blob in exactly the shape the mobile app reads back
 * (`playerName`, `partnerName`, `phone`, `email`, `notes`) — the app has no
 * columns for a walk-in's name, so this JSON is where it lives.
 */
function buildNotes(formData: FormData, addedByOrganizer: boolean) {
  return JSON.stringify({
    playerName: text(formData, 'playerName'),
    partnerName: text(formData, 'partnerName'),
    phone: text(formData, 'phone'),
    partnerPhone: text(formData, 'partnerPhone'),
    email: text(formData, 'email'),
    notes: text(formData, 'notes'),
    ...(addedByOrganizer ? { addedByOrganizer: true } : {}),
  });
}

export async function addEntry(
  tournamentId: string,
  prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();

  const categoryId = String(formData.get('categoryId') ?? '');
  const playerName = text(formData, 'playerName');
  const status = String(formData.get('status') ?? 'approved');
  const userId = text(formData, 'userId');

  if (!categoryId) return { ...fail('Pick a category.'), version: prev.version };
  if (!playerName) return { ...fail('A player or team name is required.'), version: prev.version };
  if (!isStatus(status)) return { ...fail(`Unknown status: ${status}`), version: prev.version };

  const db = supabaseAdmin();

  const { data: category } = await db
    .from('tournament_categories')
    .select('id,tournament_id')
    .eq('id', categoryId)
    .maybeSingle<{ id: string; tournament_id: string }>();

  if (!category || category.tournament_id !== tournamentId) {
    return { ...fail('That category does not belong to this tournament.'), version: prev.version };
  }

  // Capacity is deliberately not enforced: an admin adding a late entry is the
  // authority on whether the category can take one more.
  const { error } = await db.from('registrations').insert({
    user_id: userId,
    tournament_id: tournamentId,
    category_id: categoryId,
    status,
    added_by: admin.id,
    notes: buildNotes(formData, true),
  });

  if (error) return { ...fail(readableError(error)), version: prev.version };

  refresh(tournamentId);
  return { ok: true, message: `${playerName} added.`, version: prev.version + 1 };
}

// ── Editing an entry ──────────────────────────────────────

/**
 * Rewrites the name/contact fields. The app tells players to ask the organizer
 * for these corrections; here they can just be typed.
 */
export async function updateEntry(
  tournamentId: string,
  registrationId: string,
  prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const playerName = text(formData, 'playerName');
  if (!playerName) return { ...fail('A player or team name is required.'), version: prev.version };

  const db = supabaseAdmin();

  const { data: existing } = await db
    .from('registrations')
    .select('id,notes,tournament_id')
    .eq('id', registrationId)
    .maybeSingle<Pick<Registration, 'id' | 'notes' | 'tournament_id'>>();

  if (!existing || existing.tournament_id !== tournamentId) {
    return { ...fail('That entry no longer exists.'), version: prev.version };
  }

  // Keep whatever the original row recorded about who created it.
  const wasOrganizerAdded = parseNotes(existing.notes).addedByOrganizer === true;

  const { error } = await db
    .from('registrations')
    .update({ notes: buildNotes(formData, wasOrganizerAdded) })
    .eq('id', registrationId);

  if (error) return { ...fail(readableError(error)), version: prev.version };

  refresh(tournamentId);
  return { ok: true, message: 'Entry updated.', version: prev.version + 1 };
}

// ── Account lookup ────────────────────────────────────────

/** Backs the "link to a SmashDraw account" search in the add-entry form. */
export async function lookupPlayers(query: string): Promise<PlayerSummary[]> {
  await requireAdmin();
  return searchProfiles(query);
}
