-- SmashDraw Supabase Schema
-- Run this in your Supabase SQL editor

-- Enable RLS
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────
-- Profiles (extends auth.users)
-- ────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text,
  phone text,
  city text,
  state text,
  skill_level text not null default 'beginner' check (skill_level in ('beginner','intermediate','advanced','open')),
  age int,
  gender text check (gender in ('male','female','other')),
  club_name text,
  avatar_url text,
  role text not null default 'player' check (role in ('player','organizer','admin')),
  ranking_points int not null default 0,
  tournaments_played int not null default 0,
  tournaments_won int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- ────────────────────────────────────────────
-- Tournaments
-- ────────────────────────────────────────────
create table public.tournaments (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  city text not null,
  state text not null,
  venue text not null,
  venue_address text,
  start_date date not null,
  end_date date not null,
  registration_deadline date not null,
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  organizer_name text not null,
  banner_url text,
  rules text,
  status text not null default 'draft' check (status in ('draft','open','ongoing','completed','cancelled')),
  contact_phone text,
  contact_email text,
  prize_pool text,
  max_courts int,
  created_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;

create policy "Anyone can view open tournaments" on public.tournaments
  for select using (status != 'draft' or organizer_id = auth.uid());

create policy "Organizers can insert tournaments" on public.tournaments
  for insert with check (auth.uid() = organizer_id);

create policy "Organizers can update own tournaments" on public.tournaments
  for update using (auth.uid() = organizer_id);

-- ────────────────────────────────────────────
-- Tournament Categories
-- ────────────────────────────────────────────
create table public.tournament_categories (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  name text not null,
  entry_fee int not null default 0,
  max_players int not null default 32,
  current_players int not null default 0,
  skill_level text not null default 'open',
  prize text,
  created_at timestamptz not null default now()
);

alter table public.tournament_categories enable row level security;

create policy "Anyone can view categories" on public.tournament_categories
  for select using (true);

create policy "Organizers can manage categories" on public.tournament_categories
  for all using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.organizer_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────
-- Registrations
-- ────────────────────────────────────────────
create table public.registrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  category_id uuid references public.tournament_categories(id) on delete cascade not null,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','waitlisted')),
  payment_screenshot_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, category_id)
);

alter table public.registrations enable row level security;

create policy "Users can view own registrations" on public.registrations
  for select using (auth.uid() = user_id);

create policy "Organizers can view tournament registrations" on public.registrations
  for select using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.organizer_id = auth.uid()
    )
  );

create policy "Players can register" on public.registrations
  for insert with check (auth.uid() = user_id);

create policy "Players can update own registration" on public.registrations
  for update using (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- Matches
-- ────────────────────────────────────────────
create table public.matches (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  category_id uuid references public.tournament_categories(id) on delete cascade not null,
  round int not null,
  match_number int not null,
  player1_id uuid references public.profiles(id),
  player2_id uuid references public.profiles(id),
  player1_name text,
  player2_name text,
  winner_id uuid references public.profiles(id),
  score text,
  status text not null default 'scheduled' check (status in ('scheduled','live','completed','walkover')),
  scheduled_at timestamptz,
  court_number int,
  created_at timestamptz not null default now()
);

alter table public.matches enable row level security;

create policy "Anyone can view matches" on public.matches
  for select using (true);

create policy "Organizers can manage matches" on public.matches
  for all using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.organizer_id = auth.uid()
    )
  );
