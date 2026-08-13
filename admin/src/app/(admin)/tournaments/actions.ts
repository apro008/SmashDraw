'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdmin } from '~/lib/auth';
import { searchProfiles } from '~/lib/data';
import { supabaseAdmin } from '~/lib/supabaseAdmin';
import { TOURNAMENT_STATUSES, type PlayerSummary, type TournamentStatus } from '~/types';
import { fail, ok, type ActionResult, type FormState } from './[id]/state';

/**
 * Tournament and category management. Same rule as the entry actions: the
 * service role ignores RLS, so `requireAdmin()` comes first, always.
 *
 * The app's own policies only let an organizer touch their own tournaments and
 * give admins no insert or delete at all — everything here goes beyond that.
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

function decimal(formData: FormData, key: string) {
  const value = text(formData, key);
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTournamentStatus(value: string): value is TournamentStatus {
  return (TOURNAMENT_STATUSES as string[]).includes(value);
}

/** Every field the live `tournaments` table has, bar the generated ones. */
function tournamentPayload(formData: FormData) {
  return {
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    city: text(formData, 'city'),
    state: text(formData, 'state'),
    venue: text(formData, 'venue'),
    venue_address: text(formData, 'venue_address'),
    venue_latitude: decimal(formData, 'venue_latitude'),
    venue_longitude: decimal(formData, 'venue_longitude'),
    venue_map_url: text(formData, 'venue_map_url'),
    start_date: text(formData, 'start_date'),
    end_date: text(formData, 'end_date'),
    registration_deadline: text(formData, 'registration_deadline'),
    organizer_id: text(formData, 'organizer_id'),
    organizer_name: text(formData, 'organizer_name'),
    banner_url: text(formData, 'banner_url'),
    rules: text(formData, 'rules'),
    status: String(formData.get('status') ?? 'draft'),
    contact_phone: text(formData, 'contact_phone'),
    contact_phone_2: text(formData, 'contact_phone_2'),
    contact_phone_3: text(formData, 'contact_phone_3'),
    contact_email: text(formData, 'contact_email'),
    payment_address: text(formData, 'payment_address'),
    prize_pool: text(formData, 'prize_pool'),
    max_courts: integer(formData, 'max_courts'),
  };
}

function validate(payload: ReturnType<typeof tournamentPayload>) {
  const missing = (['title', 'city', 'state', 'venue', 'organizer_id'] as const).find(
    (key) => !payload[key]
  );
  if (missing) return `${missing.replace('_', ' ')} is required.`;

  if (!payload.start_date || !payload.end_date || !payload.registration_deadline) {
    return 'Start date, end date and registration deadline are all required.';
  }
  if (payload.end_date < payload.start_date) {
    return 'The end date cannot be before the start date.';
  }
  if (!isTournamentStatus(payload.status)) {
    return `Unknown status: ${payload.status}`;
  }
  return null;
}

export async function createTournament(prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const payload = tournamentPayload(formData);
  const problem = validate(payload);
  if (problem) return { ...fail(problem), version: prev.version };

  const { data, error } = await supabaseAdmin()
    .from('tournaments')
    .insert(payload)
    .select('id')
    .single<{ id: string }>();

  if (error) return { ...fail(error.message), version: prev.version };

  revalidatePath('/tournaments');
  redirect(`/tournaments/${data.id}`);
}

export async function updateTournament(
  tournamentId: string,
  prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const payload = tournamentPayload(formData);
  const problem = validate(payload);
  if (problem) return { ...fail(problem), version: prev.version };

  const { error } = await supabaseAdmin()
    .from('tournaments')
    .update(payload)
    .eq('id', tournamentId);

  if (error) return { ...fail(error.message), version: prev.version };

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath('/tournaments');
  return { ok: true, message: 'Tournament saved.', version: prev.version + 1 };
}

/** Status on its own, for the quick switch in the tournament header. */
export async function setTournamentStatus(
  tournamentId: string,
  status: string
): Promise<ActionResult> {
  await requireAdmin();

  if (!isTournamentStatus(status)) return fail(`Unknown status: ${status}`);

  const { error } = await supabaseAdmin()
    .from('tournaments')
    .update({ status })
    .eq('id', tournamentId);

  if (error) return fail(error.message);

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath('/tournaments');
  // `notify_on_tournament_status` turns this into a push for everyone registered.
  return ok(`Tournament marked ${status}.`);
}

/**
 * Deletes the tournament. Categories, registrations, matches and notifications
 * all cascade from it — this is not recoverable, so the UI types-to-confirm.
 */
export async function deleteTournament(tournamentId: string): Promise<ActionResult> {
  await requireAdmin();

  const { error } = await supabaseAdmin().from('tournaments').delete().eq('id', tournamentId);
  if (error) return fail(error.message);

  revalidatePath('/tournaments');
  redirect('/tournaments');
}

// ── Categories ────────────────────────────────────────────

export async function saveCategory(
  tournamentId: string,
  categoryId: string | null,
  prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const name = text(formData, 'name');
  if (!name) return { ...fail('A category name is required.'), version: prev.version };

  const payload = {
    tournament_id: tournamentId,
    name,
    entry_fee: integer(formData, 'entry_fee') ?? 0,
    max_players: integer(formData, 'max_players') ?? 32,
    skill_level: String(formData.get('skill_level') ?? 'open'),
    prize: text(formData, 'prize'),
  };

  const db = supabaseAdmin();
  const { error } = categoryId
    ? await db.from('tournament_categories').update(payload).eq('id', categoryId)
    : await db.from('tournament_categories').insert(payload);

  if (error) return { ...fail(error.message), version: prev.version };

  revalidatePath(`/tournaments/${tournamentId}`);
  return {
    ok: true,
    message: categoryId ? `${name} saved.` : `${name} added.`,
    version: prev.version + 1,
  };
}

/** Cascades to every registration and match in the category. */
export async function deleteCategory(
  tournamentId: string,
  categoryId: string
): Promise<ActionResult> {
  await requireAdmin();

  const { error } = await supabaseAdmin()
    .from('tournament_categories')
    .delete()
    .eq('id', categoryId);

  if (error) return fail(error.message);

  revalidatePath(`/tournaments/${tournamentId}`);
  return ok('Category deleted, along with its entries and matches.');
}

// ── Announcements ─────────────────────────────────────────

/**
 * Pushes a free-text announcement to everyone approved or waitlisted.
 *
 * Written straight into `notifications` rather than through
 * `send_tournament_announcement`, which checks `auth.uid()` — null for the
 * service role. It also avoids `broadcast_id`, a column this database does not
 * have yet (the repo's notifications.sql has not been fully applied).
 */
export async function sendAnnouncement(
  tournamentId: string,
  prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const title = text(formData, 'title');
  const body = text(formData, 'body');
  if (!title || !body) {
    return { ...fail('An announcement needs both a title and a message.'), version: prev.version };
  }

  const db = supabaseAdmin();

  const { data: recipients, error: lookupError } = await db
    .from('registrations')
    .select('user_id')
    .eq('tournament_id', tournamentId)
    .in('status', ['approved', 'waitlisted'])
    .not('user_id', 'is', null);

  if (lookupError) return { ...fail(lookupError.message), version: prev.version };

  const userIds = [
    ...new Set(((recipients ?? []) as { user_id: string }[]).map((row) => row.user_id)),
  ];

  if (userIds.length === 0) {
    return {
      ...fail('Nobody to send to — no approved or waitlisted entry has an account.'),
      version: prev.version,
    };
  }

  const { error } = await db.from('notifications').insert(
    userIds.map((userId) => ({
      user_id: userId,
      type: 'announcement',
      title,
      body,
      tournament_id: tournamentId,
      data: {},
    }))
  );

  if (error) return { ...fail(error.message), version: prev.version };

  revalidatePath(`/tournaments/${tournamentId}`);
  return {
    ok: true,
    message: `Announcement sent to ${userIds.length} ${userIds.length === 1 ? 'player' : 'players'}.`,
    version: prev.version + 1,
  };
}

// ── Organizer lookup ──────────────────────────────────────

export async function lookupOrganizers(query: string): Promise<PlayerSummary[]> {
  await requireAdmin();
  return searchProfiles(query);
}
