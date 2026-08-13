import { supabase } from '~/lib/supabase';
import type { Contestant } from '~/lib/contestants';
import type { TournamentMatchResult } from '~/types';

/**
 * Random knockout draws.
 *
 * Round 1 is a straight shuffle — no seeding, no ranking input — padded out to a
 * power of two with byes. Later rounds are not random: a bracket's shape decides
 * who meets whom, so `buildNextRound` just pairs the winners in bracket order.
 *
 * A bye is stored as a real match with no opponent and status `walkover`, so the
 * player advances without the organizer having to record anything.
 */

export interface DrawPairing {
  matchNumber: number;
  side1: Contestant | null;
  side2: Contestant | null;
  /** Side 1 advances unopposed. */
  isBye: boolean;
}

/** Fisher–Yates on a copy — the caller's array is left alone. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Smallest power of two that fits every contestant. */
export function bracketSize(entryCount: number) {
  let size = 2;
  while (size < entryCount) size *= 2;
  return size;
}

export function roundCount(entryCount: number) {
  return Math.log2(bracketSize(entryCount));
}

/**
 * Which match slots get a bye, spread from the outside in.
 *
 * Handing the byes to slots 0, 1, 2… would make every bye recipient meet another
 * bye recipient in round 2. Alternating ends keeps them apart for as long as the
 * bracket allows.
 */
function byeSlots(slots: number, byeCount: number): Set<number> {
  const order: number[] = [];
  let low = 0;
  let high = slots - 1;
  while (low <= high) {
    order.push(low);
    if (low !== high) order.push(high);
    low += 1;
    high -= 1;
  }
  return new Set(order.slice(0, byeCount));
}

export const MIN_DRAW_ENTRIES = 2;

/** Shuffles the field and lays out round 1. Throws below two contestants. */
export function generateFirstRound(contestants: Contestant[]): DrawPairing[] {
  if (contestants.length < MIN_DRAW_ENTRIES) {
    throw new Error(`A draw needs at least ${MIN_DRAW_ENTRIES} entries.`);
  }

  const shuffled = shuffle(contestants);
  const size = bracketSize(shuffled.length);
  const slots = size / 2;
  const byes = byeSlots(slots, size - shuffled.length);

  const pairings: DrawPairing[] = [];
  let next = 0;

  for (let slot = 0; slot < slots; slot++) {
    const side1 = shuffled[next++] ?? null;
    const isBye = byes.has(slot);
    pairings.push({
      matchNumber: slot + 1,
      side1,
      side2: isBye ? null : (shuffled[next++] ?? null),
      isBye,
    });
  }

  return pairings;
}

/** A match is settled once it has a winner — byes count, they are walkovers. */
export function isMatchDecided(match: TournamentMatchResult) {
  return (
    (match.status === 'completed' || match.status === 'walkover') &&
    (!!match.winner_id || !!match.winner_name)
  );
}

export function matchesInRound(matches: TournamentMatchResult[], round: number) {
  return matches
    .filter((match) => match.round === round)
    .sort((a, b) => a.match_number - b.match_number);
}

export function latestRound(matches: TournamentMatchResult[]) {
  return matches.reduce((highest, match) => Math.max(highest, match.round), 0);
}

/**
 * Pairs the winners of `round` into the round that follows. Returns null when
 * the round is not finished, or when it produced a single winner (the champion).
 */
export function buildNextRound(
  matches: TournamentMatchResult[],
  round: number
): DrawPairing[] | null {
  const played = matchesInRound(matches, round);
  if (played.length < 2 || !played.every(isMatchDecided)) return null;

  const winners: Contestant[] = played.map((match) => ({
    id: match.id,
    userId: match.winner_id,
    categoryId: match.category_id,
    name: match.winner_name ?? 'Winner',
    detail: '',
    isGuest: !match.winner_id,
  }));

  const pairings: DrawPairing[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    const side2 = winners[i + 1] ?? null;
    pairings.push({
      matchNumber: pairings.length + 1,
      side1: winners[i],
      side2,
      isBye: side2 === null,
    });
  }

  return pairings;
}

export function roundLabel(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-final';
  if (fromEnd === 2) return 'Quarter-final';
  return `Round ${round}`;
}

// ────────────────────────────────────────────
// Persistence
// ────────────────────────────────────────────

export async function fetchCategoryMatches(tournamentId: string, categoryId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId)
    .order('round', { ascending: true })
    .order('match_number', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as TournamentMatchResult[];
}

function toMatchRows(
  tournamentId: string,
  categoryId: string,
  round: number,
  pairings: DrawPairing[]
) {
  return pairings.map((pairing) => ({
    tournament_id: tournamentId,
    category_id: categoryId,
    round,
    match_number: pairing.matchNumber,
    player1_id: pairing.side1?.userId ?? null,
    player2_id: pairing.side2?.userId ?? null,
    player1_name: pairing.side1?.name ?? null,
    player2_name: pairing.side2?.name ?? null,
    // A bye is resolved the moment it is drawn.
    status: pairing.isBye ? 'walkover' : 'scheduled',
    winner_id: pairing.isBye ? (pairing.side1?.userId ?? null) : null,
    winner_name: pairing.isBye ? (pairing.side1?.name ?? null) : null,
    completed_at: pairing.isBye ? new Date().toISOString() : null,
  }));
}

/**
 * Replaces the whole draw for a category. Every existing match in the category
 * is dropped first, results included — the caller is expected to confirm that.
 */
export async function saveFirstRound(
  tournamentId: string,
  categoryId: string,
  pairings: DrawPairing[]
) {
  const { error: deleteError } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId);

  if (deleteError) throw deleteError;

  const { error } = await supabase
    .from('matches')
    .insert(toMatchRows(tournamentId, categoryId, 1, pairings));

  if (error) throw error;
}

export async function saveNextRound(
  tournamentId: string,
  categoryId: string,
  round: number,
  pairings: DrawPairing[]
) {
  // Guard against a double tap creating the round twice.
  const { error: deleteError } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId)
    .gte('round', round);

  if (deleteError) throw deleteError;

  const { error } = await supabase
    .from('matches')
    .insert(toMatchRows(tournamentId, categoryId, round, pairings));

  if (error) throw error;
}

export async function clearCategoryDraw(tournamentId: string, categoryId: string) {
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId);

  if (error) throw error;
}

/** Tells the category's registered players their draw is up. Never fatal. */
export async function announceDraw(tournamentId: string, categoryId: string) {
  const { data, error } = await supabase.rpc('notify_draw_published', {
    p_tournament_id: tournamentId,
    p_category_id: categoryId,
  });

  if (error) throw error;
  return (data as number | null) ?? 0;
}
