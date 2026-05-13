export type UserRole = 'player' | 'organizer' | 'admin';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'open';
export type TournamentStatus = 'draft' | 'open' | 'ongoing' | 'completed' | 'cancelled';
export type CategoryName =
  | "Men's Singles"
  | "Women's Singles"
  | "Men's Doubles"
  | "Women's Doubles"
  | 'Mixed Doubles'
  | "Boys' Singles"
  | "Girls' Singles"
  | "Boys' Under-15"
  | "Girls' Under-15"
  | 'Veterans Singles';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'waitlisted';
export type Gender = 'male' | 'female' | 'other';

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
  start_date: string;
  end_date: string;
  registration_deadline: string;
  organizer_id: string;
  organizer_name: string;
  banner_url: string | null;
  rules: string | null;
  status: TournamentStatus;
  contact_phone: string | null;
  contact_email: string | null;
  prize_pool: string | null;
  max_courts: number | null;
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
  user_id: string;
  category_id: string;
  tournament_id: string;
  status: RegistrationStatus;
  payment_screenshot_url: string | null;
  notes: string | null;
  created_at: string;
  tournament?: Tournament;
  category?: TournamentCategory;
}
