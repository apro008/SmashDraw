/**
 * Mirror of the mobile app's `src/types/index.ts`. Kept as a copy rather than a
 * shared package so this app can be deployed on its own — if you change a shape
 * in the app, change it here too.
 */

export type UserRole = 'player' | 'organizer' | 'admin';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'open';
export type TournamentStatus = 'draft' | 'open' | 'ongoing' | 'paused' | 'completed' | 'cancelled';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'waitlisted';
export type Gender = 'male' | 'female' | 'other';

export const REGISTRATION_STATUSES: RegistrationStatus[] = [
  'pending',
  'approved',
  'waitlisted',
  'rejected',
];

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  skill_level: SkillLevel;
  age: number | null;
  gender: Gender | null;
  club_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  ranking_points: number;
  tournaments_played: number;
  tournaments_won: number;
  created_at: string;
}

export const TOURNAMENT_STATUSES: TournamentStatus[] = [
  'draft',
  'open',
  'ongoing',
  'paused',
  'completed',
  'cancelled',
];

export const USER_ROLES: UserRole[] = ['player', 'organizer', 'admin'];

export const SKILL_LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'open'];

export interface Tournament {
  id: string;
  title: string;
  description: string | null;
  city: string;
  state: string;
  venue: string;
  venue_address: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  venue_map_url: string | null;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  organizer_id: string;
  organizer_name: string;
  banner_url: string | null;
  rules: string | null;
  status: TournamentStatus;
  contact_phone: string | null;
  contact_phone_2: string | null;
  contact_phone_3: string | null;
  contact_email: string | null;
  payment_address: string | null;
  prize_pool: string | null;
  max_courts: number | null;
  created_at: string;
  categories?: TournamentCategory[];
}

export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'walkover';

export interface Match {
  id: string;
  tournament_id: string;
  category_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_name: string | null;
  player2_name: string | null;
  winner_id: string | null;
  winner_name: string | null;
  score: string | null;
  player1_score: number | null;
  player2_score: number | null;
  result_notes: string | null;
  prize_money_received: number | null;
  status: MatchStatus;
  scheduled_at: string | null;
  completed_at: string | null;
  court_number: number | null;
  created_at: string;
}

export interface TournamentCategory {
  id: string;
  tournament_id: string;
  name: string;
  entry_fee: number;
  max_players: number;
  current_players: number;
  skill_level: SkillLevel | 'open';
  prize: string | null;
}

export interface Registration {
  id: string;
  /** Null for walk-ins added by name — they have no account. */
  user_id: string | null;
  category_id: string;
  tournament_id: string;
  status: RegistrationStatus;
  payment_screenshot_url: string | null;
  notes: string | null;
  /** Set when an organizer or admin created the entry rather than the player. */
  added_by: string | null;
  created_at: string;
}

/** Shape the app JSON-encodes into `registrations.notes`. */
export interface RegistrationNotes {
  playerName?: string;
  phone?: string;
  email?: string;
  partnerName?: string | null;
  partnerPhone?: string | null;
  notes?: string | null;
  addedByOrganizer?: boolean;
}

export type PlayerSummary = Pick<
  UserProfile,
  'id' | 'name' | 'email' | 'phone' | 'city' | 'state'
>;

export interface RegistrationDetails extends Registration {
  category: TournamentCategory | null;
  player: PlayerSummary | null;
}
