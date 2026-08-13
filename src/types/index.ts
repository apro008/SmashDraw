export type UserRole = 'player' | 'organizer' | 'admin';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'open';
export type TournamentStatus = 'draft' | 'open' | 'ongoing' | 'paused' | 'completed' | 'cancelled';
export type CategoryName = string;
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'waitlisted';
export type Gender = 'male' | 'female' | 'other';

export type NotificationType =
  | 'registration_approved'
  | 'registration_rejected'
  | 'registration_waitlisted'
  | 'registration_received'
  | 'match_scheduled'
  | 'match_result'
  | 'tournament_status'
  | 'tournament_published'
  | 'announcement';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  tournament_id: string | null;
  match_id: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  device_name: string | null;
  created_at: string;
  updated_at: string;
}

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
  /** Stamped the first time the tournament opens, so it is announced only once. */
  announced_at: string | null;
  created_at: string;
  categories?: TournamentCategory[];
}

export interface TournamentCategory {
  id: string;
  tournament_id: string;
  name: CategoryName;
  entry_fee: number;
  max_players: number;
  current_players: number;
  skill_level: SkillLevel | 'open';
  prize: string | null;
}

export interface Registration {
  id: string;
  /** Null for walk-ins the organizer added by name — they have no account. */
  user_id: string | null;
  category_id: string;
  tournament_id: string;
  status: RegistrationStatus;
  payment_screenshot_url: string | null;
  notes: string | null;
  /** Set when an organizer or admin created the entry rather than the player. */
  added_by: string | null;
  created_at: string;
  tournament?: Tournament;
  category?: TournamentCategory;
}

export interface TournamentMatchResult {
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
  status: 'scheduled' | 'live' | 'completed' | 'walkover';
  scheduled_at: string | null;
  completed_at: string | null;
  court_number: number | null;
  created_at: string;
  category?: TournamentCategory;
}
