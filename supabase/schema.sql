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
  venue_latitude double precision,
  venue_longitude double precision,
  venue_map_url text,
  start_date date not null,
  end_date date not null,
  registration_deadline date not null,
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  organizer_name text not null,
  banner_url text,
  rules text,
  status text not null default 'draft' check (status in ('draft','open','ongoing','paused','completed','cancelled')),
  contact_phone text,
  contact_phone_2 text,
  contact_phone_3 text,
  contact_email text,
  payment_address text,
  prize_pool text,
  max_courts int,
  created_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;

create policy "Anyone can view open tournaments" on public.tournaments
  for select using (status != 'draft' or organizer_id = auth.uid());

create policy "Admins can view all tournaments" on public.tournaments
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Organizers can insert tournaments" on public.tournaments
  for insert with check (auth.uid() = organizer_id);

create policy "Organizers can update own tournaments" on public.tournaments
  for update using (auth.uid() = organizer_id);

create policy "Admins can update all tournaments" on public.tournaments
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Organizers can delete own tournaments" on public.tournaments
  for delete using (auth.uid() = organizer_id);

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

create policy "Admins can view all registrations" on public.registrations
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Players can register for open tournaments" on public.registrations
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.status = 'open'
    )
  );

create policy "Organizers can update tournament registrations" on public.registrations
  for update using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.organizer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.organizer_id = auth.uid()
    )
  );

create policy "Admins can update all registrations" on public.registrations
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create or replace function public.set_registration_status(
  p_registration_id uuid,
  p_status text
)
returns table(id uuid, status text) as $$
begin
  if p_status not in ('approved', 'rejected', 'waitlisted') then
    raise exception 'Invalid registration status: %', p_status;
  end if;

  return query
  update public.registrations r
  set status = p_status
  where r.id = p_registration_id
    and (
      exists (
        select 1
        from public.tournaments t
        where t.id = r.tournament_id
          and t.organizer_id = auth.uid()
      )
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
      )
    )
  returning r.id, r.status;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.set_registration_status(uuid, text) to authenticated;

create or replace function public.sync_category_registration_count()
returns trigger as $$
declare
  changed_category_id uuid;
begin
  changed_category_id := case when tg_op = 'DELETE' then old.category_id else new.category_id end;

  update public.tournament_categories
  set current_players = (
    select count(*)::int
    from public.registrations r
    where r.category_id = changed_category_id
      and r.status = 'approved'
  )
  where id = changed_category_id;

  if tg_op = 'UPDATE' and old.category_id is distinct from new.category_id then
    update public.tournament_categories
    set current_players = (
      select count(*)::int
      from public.registrations r
      where r.category_id = old.category_id
        and r.status = 'approved'
    )
    where id = old.category_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_registration_created_increment_category
after insert or delete or update of category_id, status on public.registrations
for each row
execute function public.sync_category_registration_count();

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
  winner_name text,
  score text,
  player1_score int,
  player2_score int,
  result_notes text,
  prize_money_received int,
  status text not null default 'scheduled' check (status in ('scheduled','live','completed','walkover')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  court_number int,
  result_uploaded_by uuid references public.profiles(id),
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

create policy "Admins can manage matches" on public.matches
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
