import 'server-only';

import { supabaseAdmin } from './supabaseAdmin';
import type {
  Match,
  PlayerSummary,
  Registration,
  RegistrationDetails,
  RegistrationStatus,
  Tournament,
  TournamentCategory,
  UserProfile,
} from '~/types';

const PLAYER_COLUMNS = 'id,name,email,phone,city,state';

export interface TournamentListRow extends Tournament {
  counts: Record<RegistrationStatus, number> & { total: number };
}

const EMPTY_COUNTS = (): TournamentListRow['counts'] => ({
  pending: 0,
  approved: 0,
  waitlisted: 0,
  rejected: 0,
  total: 0,
});

/** Every tournament, drafts included — the service role sees past the RLS filter. */
export async function fetchAllTournaments(): Promise<TournamentListRow[]> {
  const db = supabaseAdmin();

  const [tournaments, registrations] = await Promise.all([
    db
      .from('tournaments')
      .select('*, categories:tournament_categories(*)')
      .order('start_date', { ascending: false }),
    db.from('registrations').select('tournament_id,status'),
  ]);

  if (tournaments.error) throw tournaments.error;
  if (registrations.error) throw registrations.error;

  const counts = new Map<string, TournamentListRow['counts']>();
  for (const row of (registrations.data ?? []) as Pick<
    Registration,
    'tournament_id' | 'status'
  >[]) {
    const bucket = counts.get(row.tournament_id) ?? EMPTY_COUNTS();
    bucket[row.status] = (bucket[row.status] ?? 0) + 1;
    bucket.total += 1;
    counts.set(row.tournament_id, bucket);
  }

  return ((tournaments.data ?? []) as Tournament[]).map((tournament) => ({
    ...tournament,
    categories: sortCategories(tournament.categories ?? []),
    counts: counts.get(tournament.id) ?? EMPTY_COUNTS(),
  }));
}

export async function fetchTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await supabaseAdmin()
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle<Tournament>();

  if (error) throw error;
  return data;
}

export async function fetchMatches(tournamentId: string): Promise<Match[]> {
  const { data, error } = await supabaseAdmin()
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('match_number', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Match[];
}

/** Every profile, newest first. Small enough a table to load in one go. */
export async function fetchProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

export interface TournamentDetail {
  tournament: Tournament;
  categories: TournamentCategory[];
  registrations: RegistrationDetails[];
}

export async function fetchTournamentDetail(id: string): Promise<TournamentDetail | null> {
  const db = supabaseAdmin();

  const { data: tournament, error } = await db
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle<Tournament>();

  if (error) throw error;
  if (!tournament) return null;

  const [categoriesResult, registrationsResult] = await Promise.all([
    db.from('tournament_categories').select('*').eq('tournament_id', id),
    db
      .from('registrations')
      .select('*')
      .eq('tournament_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (registrationsResult.error) throw registrationsResult.error;

  const categories = sortCategories((categoriesResult.data ?? []) as TournamentCategory[]);
  const registrations = (registrationsResult.data ?? []) as Registration[];

  // Deliberately a second query rather than a PostgREST embed: `registrations`
  // has two foreign keys into `profiles` (user_id and added_by), so an
  // unqualified `profiles(...)` embed is ambiguous and errors out.
  const players = await fetchPlayers(registrations.map((r) => r.user_id));
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return {
    tournament,
    categories,
    registrations: registrations.map((registration) => ({
      ...registration,
      category: categoryById.get(registration.category_id) ?? null,
      player: registration.user_id ? (players.get(registration.user_id) ?? null) : null,
    })),
  };
}

async function fetchPlayers(userIds: (string | null)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map<string, PlayerSummary>();

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .select(PLAYER_COLUMNS)
    .in('id', ids);

  if (error) throw error;
  return new Map(((data ?? []) as PlayerSummary[]).map((player) => [player.id, player]));
}

/** Name/email lookup, for attaching a manual entry to a real account. */
export async function searchProfiles(query: string, limit = 8): Promise<PlayerSummary[]> {
  // `or()` takes a raw filter string, so characters with meaning in PostgREST's
  // grammar have to come out or the caller could rewrite the whole condition.
  const term = query.trim().replace(/[,()*%\\"]/g, '');
  if (term.length < 2) return [];

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .select(PLAYER_COLUMNS)
    .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PlayerSummary[];
}

const CATEGORY_ORDER = ['Singles', 'Doubles', 'Mixed'];

function sortCategories(categories: TournamentCategory[]) {
  return [...categories].sort((a, b) => {
    const aIndex = CATEGORY_ORDER.findIndex((key) => a.name.includes(key));
    const bIndex = CATEGORY_ORDER.findIndex((key) => b.name.includes(key));
    return (
      (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a.name.localeCompare(b.name)
    );
  });
}
