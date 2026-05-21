import { supabase } from '~/lib/supabase';
import {
  Registration,
  RegistrationStatus,
  Tournament,
  TournamentCategory,
  TournamentMatchResult,
  TournamentStatus,
  UserProfile,
} from '~/types';

const TOURNAMENT_SELECT = `
  *,
  categories:tournament_categories(*)
`;

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
