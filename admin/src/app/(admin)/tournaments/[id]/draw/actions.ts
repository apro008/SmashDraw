'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '~/lib/auth';
import { fetchTournamentDetail } from '~/lib/data';
import {
  buildNextRound,
  generateFirstRound,
  toMatchRows,
  type Contestant,
} from '~/lib/draw';
import { isDoublesCategory, toEntryView } from '~/lib/notes';
import { supabaseAdmin } from '~/lib/supabaseAdmin';
import type { Match } from '~/types';
import { fail, ok, type ActionResult, type FormState } from '../state';

/**
 * Draw generation, written straight to `matches`. The app does the same thing
 * from the organizer's phone; the difference here is that an admin can do it for
 * any tournament, and can overwrite a bracket that already has results in it.
 */

function refresh(tournamentId: string) {
  revalidatePath(`/tournaments/${tournamentId}/draw`);
}

/** Approved entries in a category, named the way the app names them. */
async function contestantsFor(tournamentId: string, categoryId: string): Promise<Contestant[]> {
  const detail = await fetchTournamentDetail(tournamentId);
  if (!detail) return [];

  const category = detail.categories.find((item) => item.id === categoryId);
  const doubles = isDoublesCategory(category?.name);

  return detail.registrations
    .filter((registration) => registration.category_id === categoryId)
    .filter((registration) => registration.status === 'approved')
    .map((registration) => {
      const view = toEntryView(registration);
      return {
        id: registration.id,
        userId: registration.user_id,
        name:
          doubles && view.partnerName
            ? `${view.displayName} / ${view.partnerName}`
            : view.displayName,
      };
    });
}

/** Replaces the whole draw for a category — existing results included. */
export async function generateDraw(
  tournamentId: string,
  categoryId: string
): Promise<ActionResult> {
  await requireAdmin();

  const contestants = await contestantsFor(tournamentId, categoryId);

  let pairings;
  try {
    pairings = generateFirstRound(contestants);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Could not generate the draw.');
  }

  const db = supabaseAdmin();

  const { error: deleteError } = await db
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId);

  if (deleteError) return fail(deleteError.message);

  const { error } = await db
    .from('matches')
    .insert(toMatchRows(tournamentId, categoryId, 1, pairings));

  if (error) return fail(error.message);

  refresh(tournamentId);
  const byes = pairings.filter((pairing) => pairing.isBye).length;
  return ok(
    `Round 1 drawn — ${contestants.length} entries, ${pairings.length} matches` +
      (byes > 0 ? `, ${byes} bye${byes === 1 ? '' : 's'}.` : '.')
  );
}

/** Pairs the winners of `round` into the next one. */
export async function advanceRound(
  tournamentId: string,
  categoryId: string,
  round: number
): Promise<ActionResult> {
  await requireAdmin();

  const db = supabaseAdmin();

  const { data, error: readError } = await db
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId);

  if (readError) return fail(readError.message);

  const pairings = buildNextRound((data ?? []) as Match[], round);
  if (!pairings) {
    return fail('That round is not finished — every match needs a winner first.');
  }

  // Guard against a double tap creating the round twice.
  const { error: deleteError } = await db
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId)
    .gte('round', round + 1);

  if (deleteError) return fail(deleteError.message);

  const { error } = await db
    .from('matches')
    .insert(toMatchRows(tournamentId, categoryId, round + 1, pairings));

  if (error) return fail(error.message);

  refresh(tournamentId);
  return ok(`Round ${round + 1} created with ${pairings.length} matches.`);
}

export async function clearDraw(tournamentId: string, categoryId: string): Promise<ActionResult> {
  await requireAdmin();

  const { error } = await supabaseAdmin()
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId);

  if (error) return fail(error.message);

  refresh(tournamentId);
  return ok('Draw cleared.');
}

// ── One match ─────────────────────────────────────────────

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

/**
 * Full manual control over a match: rename either side, set the score, pick the
 * winner, assign a court, schedule it. Setting a winner is what unlocks the next
 * round.
 */
export async function updateMatch(
  tournamentId: string,
  matchId: string,
  prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireAdmin();

  const db = supabaseAdmin();

  const { data: match } = await db
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle<Match>();

  if (!match || match.tournament_id !== tournamentId) {
    return { ...fail('That match no longer exists.'), version: prev.version };
  }

  const player1Name = text(formData, 'player1_name');
  const player2Name = text(formData, 'player2_name');
  const player1Score = integer(formData, 'player1_score');
  const player2Score = integer(formData, 'player2_score');
  const status = String(formData.get('status') ?? match.status);
  const winnerSide = String(formData.get('winner') ?? '');

  // The winner is picked by side, so a rename in the same save still lands on
  // the right person, and the player id follows the side it belongs to.
  const winner =
    winnerSide === '1'
      ? { winner_id: match.player1_id, winner_name: player1Name }
      : winnerSide === '2'
        ? { winner_id: match.player2_id, winner_name: player2Name }
        : { winner_id: null, winner_name: null };

  const scheduledAt = text(formData, 'scheduled_at');

  const { error } = await db
    .from('matches')
    .update({
      player1_name: player1Name,
      player2_name: player2Name,
      player1_score: player1Score,
      player2_score: player2Score,
      score:
        player1Score !== null && player2Score !== null
          ? `${player1Score}-${player2Score}`
          : text(formData, 'score'),
      court_number: integer(formData, 'court_number'),
      // `datetime-local` has no zone; the browser's own offset is the sane read.
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      result_notes: text(formData, 'result_notes'),
      prize_money_received: integer(formData, 'prize_money_received'),
      status,
      completed_at:
        status === 'completed' || status === 'walkover'
          ? (match.completed_at ?? new Date().toISOString())
          : null,
      ...winner,
    })
    .eq('id', matchId);

  if (error) return { ...fail(error.message), version: prev.version };

  refresh(tournamentId);
  // `notify_on_match_change` pushes the schedule or the result to both players.
  return { ok: true, message: 'Match saved.', version: prev.version + 1 };
}

/** One-tap winner from the bracket, without opening the full match form. */
export async function setMatchWinner(
  tournamentId: string,
  matchId: string,
  side: 1 | 2
): Promise<ActionResult> {
  await requireAdmin();

  const db = supabaseAdmin();

  const { data: match } = await db
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle<Match>();

  if (!match || match.tournament_id !== tournamentId) return fail('That match no longer exists.');

  const winnerId = side === 1 ? match.player1_id : match.player2_id;
  const winnerName = side === 1 ? match.player1_name : match.player2_name;

  if (!winnerName && !winnerId) return fail('That side is empty.');

  const { error } = await db
    .from('matches')
    .update({
      winner_id: winnerId,
      winner_name: winnerName,
      status: 'completed',
      completed_at: match.completed_at ?? new Date().toISOString(),
    })
    .eq('id', matchId);

  if (error) return fail(error.message);

  refresh(tournamentId);
  return ok(`${winnerName ?? 'Player'} advances.`);
}

// ── Publishing ────────────────────────────────────────────

/**
 * Tells the category's players their draw is up.
 *
 * `notify_draw_published` does not exist on this database yet (features.sql has
 * not been run), and it checks `auth.uid()` besides, so the rows go in directly.
 */
export async function publishDraw(
  tournamentId: string,
  categoryId: string
): Promise<ActionResult> {
  await requireAdmin();

  const db = supabaseAdmin();

  const [{ data: tournament }, { data: category }, { data: recipients, error }] = await Promise.all(
    [
      db.from('tournaments').select('title').eq('id', tournamentId).maybeSingle<{ title: string }>(),
      db
        .from('tournament_categories')
        .select('name')
        .eq('id', categoryId)
        .maybeSingle<{ name: string }>(),
      db
        .from('registrations')
        .select('user_id')
        .eq('tournament_id', tournamentId)
        .eq('category_id', categoryId)
        .eq('status', 'approved')
        .not('user_id', 'is', null),
    ]
  );

  if (error) return fail(error.message);

  const userIds = [
    ...new Set(((recipients ?? []) as { user_id: string }[]).map((row) => row.user_id)),
  ];

  if (userIds.length === 0) return fail('Nobody in this category has an account to notify.');

  const { error: insertError } = await db.from('notifications').insert(
    userIds.map((userId) => ({
      user_id: userId,
      type: 'announcement',
      title: 'Draw is out',
      body:
        `The ${category?.name ?? 'category'} draw for ${tournament?.title ?? 'the tournament'} ` +
        `has been published. Check your first match.`,
      tournament_id: tournamentId,
      data: { category_id: categoryId },
    }))
  );

  if (insertError) return fail(insertError.message);

  return ok(`Draw announced to ${userIds.length} ${userIds.length === 1 ? 'player' : 'players'}.`);
}
