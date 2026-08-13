import { supabase } from '~/lib/supabase';
import {
  Registration,
  RegistrationStatus,
  Tournament,
  TournamentCategory,
  TournamentMatchResult,
  TournamentStatus,
  UserProfile,
  UserRole,
} from '~/types';

const TOURNAMENT_SELECT = `
  *,
  categories:tournament_categories(*)
`;

/** A tournament is treated as finished/closed this many days after its end date. */
export const TOURNAMENT_CLOSE_AFTER_DAYS = 7;

/** Parses a `YYYY-MM-DD` DB date into local midnight (avoids the UTC shift of `new Date(str)`). */
export function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Formats a Date as the `YYYY-MM-DD` string the DB expects, using local calendar values. */
export function toDateOnlyString(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Local midnight of the day the tournament auto-closes. */
export function getTournamentCloseDate(tournament: Pick<Tournament, 'end_date'>) {
  const closeDate = parseDateOnly(tournament.end_date);
  closeDate.setDate(closeDate.getDate() + TOURNAMENT_CLOSE_AFTER_DAYS);
  return closeDate;
}

/** True once a week has passed since the last match day. Drafts/cancelled events never auto-close. */
export function isTournamentClosed(
  tournament: Pick<Tournament, 'end_date' | 'status'>,
  now: Date = new Date()
) {
  if (tournament.status === 'draft' || tournament.status === 'cancelled') return false;
  return now.getTime() >= getTournamentCloseDate(tournament).getTime();
}

/** Status to display: a tournament past its close window always reads as completed. */
export function getEffectiveTournamentStatus(
  tournament: Pick<Tournament, 'end_date' | 'status'>,
  now: Date = new Date()
): TournamentStatus {
  return isTournamentClosed(tournament, now) ? 'completed' : tournament.status;
}

/**
 * Display order for any tournament list. Anything a player can still act on
 * floats up; finished events sink. Every list screen sorts through this so the
 * ordering never disagrees between Home, Explore and My Events.
 */
const STATUS_RANK: Record<TournamentStatus, number> = {
  open: 0,
  ongoing: 1,
  paused: 2,
  draft: 3,
  completed: 4,
  cancelled: 5,
};

/** Lower sorts earlier. Uses the *effective* status, so auto-closed events rank as ended. */
export function getTournamentStatusRank(
  tournament: Pick<Tournament, 'end_date' | 'status'>,
  now: Date = new Date()
) {
  return STATUS_RANK[getEffectiveTournamentStatus(tournament, now)] ?? 99;
}

/** True once the event is over — used to dim it in lists. */
export function isTournamentEnded(
  tournament: Pick<Tournament, 'end_date' | 'status'>,
  now: Date = new Date()
) {
  const status = getEffectiveTournamentStatus(tournament, now);
  return status === 'completed' || status === 'cancelled';
}

/**
 * Status-ranked copy of the list. `Array.sort` is stable, so tournaments with
 * the same status keep whatever order the caller passed in — the queries
 * already sort by date, and that ordering survives inside each status group.
 */
export function sortTournamentsByStatus<T extends Pick<Tournament, 'end_date' | 'status'>>(
  tournaments: T[],
  now: Date = new Date()
): T[] {
  return [...tournaments].sort(
    (a, b) => getTournamentStatusRank(a, now) - getTournamentStatusRank(b, now)
  );
}

/** Whole days left before the tournament closes for the organizer (negative once closed). */
export function getDaysUntilClose(
  tournament: Pick<Tournament, 'end_date'>,
  now: Date = new Date()
) {
  const startOfNow = new Date(now);
  startOfNow.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (getTournamentCloseDate(tournament).getTime() - startOfNow.getTime()) / msPerDay
  );
}

/**
 * Persists the auto-close once the window has passed. Only organizers/admins can write this,
 * so callers should skip it for players. Returns true when the status was changed.
 */
export async function closeTournamentIfDue(tournament: Tournament) {
  if (tournament.status === 'completed' || !isTournamentClosed(tournament)) return false;
  await updateTournamentStatus(tournament.id, 'completed');
  return true;
}

export async function fetchOpenTournaments() {
  const { data, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_SELECT)
    .in('status', ['open', 'ongoing'])
    .order('start_date', { ascending: true });

  if (error) throw error;
  return ((data as Tournament[]) ?? []).map(sortTournamentCategories);
}

export async function fetchDiscoverableTournaments() {
  const { data, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_SELECT)
    .in('status', ['open', 'ongoing', 'paused', 'completed'])
    .order('start_date', { ascending: true });

  if (error) throw error;
  return ((data as Tournament[]) ?? []).map(sortTournamentCategories);
}

export async function fetchAdminTournaments() {
  const { data, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data as Tournament[]) ?? []).map(sortTournamentCategories);
}

export async function fetchTournamentById(id: string) {
  const { data, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? sortTournamentCategories(data as Tournament) : null;
}

export async function fetchOrganizerTournaments(organizerId: string) {
  const { data, error } = await supabase
    .from('tournaments')
    .select(TOURNAMENT_SELECT)
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data as Tournament[]) ?? []).map(sortTournamentCategories);
}

export async function fetchRegisteredTournaments(userId: string) {
  const { data, error } = await supabase
    .from('registrations')
    .select(
      `
      id,
      status,
      tournament:tournaments(${TOURNAMENT_SELECT}),
      category:tournament_categories(*)
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (((data ?? []) as unknown as { tournament: Tournament | null }[]) ?? [])
    .map((row) => row.tournament)
    .filter((tournament): tournament is Tournament => tournament !== null)
    .map(sortTournamentCategories);
}

export interface TournamentRegistrationDetails extends Registration {
  category: TournamentCategory;
  player: Pick<UserProfile, 'id' | 'name' | 'email' | 'phone' | 'city' | 'state'> | null;
}

export async function fetchTournamentRegistrations(tournamentId: string) {
  const { data, error } = await supabase
    .from('registrations')
    .select(
      `
      *,
      category:tournament_categories(*),
      player:profiles(id,name,email,phone,city,state)
    `
    )
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as TournamentRegistrationDetails[]).map((registration) => ({
    ...registration,
    category: Array.isArray(registration.category)
      ? registration.category[0]
      : registration.category,
    player: Array.isArray(registration.player) ? registration.player[0] : registration.player,
  }));
}

export async function fetchUserTournamentRegistrations(tournamentId: string, userId: string) {
  const { data, error } = await supabase
    .from('registrations')
    .select(
      `
      *,
      category:tournament_categories(*),
      player:profiles(id,name,email,phone,city,state)
    `
    )
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as TournamentRegistrationDetails[]).map((registration) => ({
    ...registration,
    category: Array.isArray(registration.category)
      ? registration.category[0]
      : registration.category,
    player: Array.isArray(registration.player) ? registration.player[0] : registration.player,
  }));
}

export async function updateRegistrationStatus(
  registrationId: string,
  status: Extract<RegistrationStatus, 'approved' | 'rejected' | 'waitlisted'>
) {
  const { data, error } = await supabase.rpc('set_registration_status', {
    p_registration_id: registrationId,
    p_status: status,
  });

  if (error) throw error;
  const updatedRow = Array.isArray(data) ? data[0] : data;
  if (!updatedRow) {
    throw new Error('Registration status was not updated. Please check organizer access.');
  }
  return updatedRow;
}

export interface AddTournamentEntryInput {
  tournamentId: string;
  categoryId: string;
  playerName: string;
  partnerName?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Set to attach the entry to a real SmashDraw account, so they get push. */
  userId?: string | null;
  notes?: string | null;
}

/** Organizer/admin adds a player or team straight onto the roster, already approved. */
export async function addTournamentEntry(input: AddTournamentEntryInput) {
  const { data, error } = await supabase.rpc('add_tournament_entry', {
    p_tournament_id: input.tournamentId,
    p_category_id: input.categoryId,
    p_player_name: input.playerName,
    p_partner_name: input.partnerName ?? null,
    p_phone: input.phone ?? null,
    p_email: input.email ?? null,
    p_user_id: input.userId ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;
  return data as string;
}

/** Only removes entries an organizer added; player registrations are declined instead. */
export async function removeTournamentEntry(registrationId: string) {
  const { data, error } = await supabase.rpc('remove_tournament_entry', {
    p_registration_id: registrationId,
  });

  if (error) throw error;
  if (data !== true) {
    throw new Error('That entry could not be removed. Only organizer-added entries can be.');
  }
}

/** Name/email lookup for attaching an organizer-added entry to a real account. */
export async function searchPlayers(query: string, limit = 8) {
  // `or()` takes a filter string, so anything with meaning in PostgREST's grammar
  // has to come out of the term or the user could rewrite the whole condition.
  const term = query.trim().replace(/[,()*%\\"]/g, '');
  if (term.length < 2) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,email,phone,city,state')
    .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Pick<UserProfile, 'id' | 'name' | 'email' | 'phone' | 'city' | 'state'>[];
}

export async function updateTournamentStatus(tournamentId: string, status: TournamentStatus) {
  const { error } = await supabase.from('tournaments').update({ status }).eq('id', tournamentId);
  if (error) throw error;
}

export async function fetchTournamentResults(tournamentId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select(
      `
      *,
      category:tournament_categories(*)
    `
    )
    .eq('tournament_id', tournamentId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as TournamentMatchResult[]).map((result) => ({
    ...result,
    category: Array.isArray(result.category) ? result.category[0] : result.category,
  }));
}

export interface SaveTournamentResultInput {
  tournamentId: string;
  categoryId: string;
  player1Id: string | null;
  player2Id: string | null;
  player1Name: string;
  player2Name: string;
  winnerId: string | null;
  winnerName: string;
  player1Score: number;
  player2Score: number;
  scoreText?: string;
  prizeMoneyReceived: number | null;
  notes: string | null;
  uploadedBy: string;
}

export async function saveTournamentResult(input: SaveTournamentResultInput) {
  const { count, error: countError } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', input.tournamentId)
    .eq('category_id', input.categoryId);

  if (countError) throw countError;

  const { error } = await supabase.from('matches').insert({
    tournament_id: input.tournamentId,
    category_id: input.categoryId,
    round: 1,
    match_number: (count ?? 0) + 1,
    player1_id: input.player1Id,
    player2_id: input.player2Id,
    player1_name: input.player1Name,
    player2_name: input.player2Name,
    winner_id: input.winnerId,
    winner_name: input.winnerName,
    player1_score: input.player1Score,
    player2_score: input.player2Score,
    score: input.scoreText ?? `${input.player1Score}-${input.player2Score}`,
    prize_money_received: input.prizeMoneyReceived,
    result_notes: input.notes,
    result_uploaded_by: input.uploadedBy,
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function updateTournamentResult(matchId: string, input: SaveTournamentResultInput) {
  const { error } = await supabase
    .from('matches')
    .update({
      category_id: input.categoryId,
      player1_id: input.player1Id,
      player2_id: input.player2Id,
      player1_name: input.player1Name,
      player2_name: input.player2Name,
      winner_id: input.winnerId,
      winner_name: input.winnerName,
      player1_score: input.player1Score,
      player2_score: input.player2Score,
      score: input.scoreText ?? `${input.player1Score}-${input.player2Score}`,
      prize_money_received: input.prizeMoneyReceived,
      result_notes: input.notes,
      result_uploaded_by: input.uploadedBy,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', matchId);

  if (error) throw error;
}

export interface ResultAccess {
  /** Can open the result sheet for this tournament at all. */
  canManage: boolean;
  /** True for organizers blocked by the close window (admins are never blocked). */
  lockedByCloseWindow: boolean;
  isAdmin: boolean;
  isOwner: boolean;
}

/**
 * Admins can always add or fix a result. The organizer can do so until the tournament
 * auto-closes, one week after the last match day.
 */
export function getResultAccess(
  tournament: Pick<Tournament, 'end_date' | 'organizer_id' | 'status'> | null,
  userId: string | null | undefined,
  role: UserRole | null | undefined
): ResultAccess {
  const isAdmin = role === 'admin';
  const isOwner = !!tournament && !!userId && tournament.organizer_id === userId;
  const closed = !!tournament && isTournamentClosed(tournament);
  return {
    canManage: !!tournament && (isAdmin || (isOwner && !closed)),
    lockedByCloseWindow: isOwner && !isAdmin && closed,
    isAdmin,
    isOwner,
  };
}

function sortTournamentCategories(tournament: Tournament) {
  return {
    ...tournament,
    categories: [...(tournament.categories ?? [])].sort(compareCategories),
  };
}

function compareCategories(a: TournamentCategory, b: TournamentCategory) {
  const order = ['Singles', 'Doubles', 'Mixed'];
  const aIndex = order.findIndex((key) => a.name.includes(key));
  const bIndex = order.findIndex((key) => b.name.includes(key));
  return (
    (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a.name.localeCompare(b.name)
  );
}
