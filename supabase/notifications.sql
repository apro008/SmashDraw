-- SmashDraw — Push notifications
-- Run this in your Supabase SQL editor after schema.sql
--
-- Two tables:
--   push_tokens   — one row per device per user (Expo push tokens)
--   notifications — the in-app feed; every row is also dispatched as a push
--
-- Rows land in `notifications` from database triggers on registration/match/
-- tournament activity. An AFTER INSERT trigger then calls the `send-push`
-- Edge Function over pg_net, which delivers to Expo's push service.
--
-- Fan-outs (a tournament opening, a status change, an organizer announcement)
-- write their rows in one statement under a shared `broadcast_id` and dispatch
-- once, instead of one HTTP request per recipient.
--
-- Re-runnable. Run supabase/features.sql afterwards for the roster and draw
-- features, which are independent of this file.

create extension if not exists "uuid-ossp";
create extension if not exists pg_net;

-- ────────────────────────────────────────────
-- Push tokens
-- ────────────────────────────────────────────
create table if not exists public.push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  token text not null unique,
  platform text not null check (platform in ('ios','android','web')),
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "Users can view own push tokens" on public.push_tokens;
create policy "Users can view own push tokens" on public.push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own push tokens" on public.push_tokens;
create policy "Users can insert own push tokens" on public.push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own push tokens" on public.push_tokens;
create policy "Users can update own push tokens" on public.push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push tokens" on public.push_tokens;
create policy "Users can delete own push tokens" on public.push_tokens
  for delete using (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- Notifications (in-app feed)
-- ────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in (
    'registration_approved',
    'registration_rejected',
    'registration_waitlisted',
    'registration_received',
    'match_scheduled',
    'match_result',
    'tournament_status',
    'announcement'
  )),
  title text not null,
  body text not null,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Fan-out rows (new tournament, status change, announcement) share a broadcast_id.
-- They skip the per-row push trigger; one dispatch covers the whole batch.
alter table public.notifications add column if not exists broadcast_id uuid;

-- Re-stated as a named constraint so the type list can grow on an existing database.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'registration_approved',
  'registration_rejected',
  'registration_waitlisted',
  'registration_received',
  'match_scheduled',
  'match_result',
  'tournament_status',
  'tournament_published',
  'announcement'
));

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(user_id) where read_at is null;
create index if not exists notifications_broadcast_idx
  on public.notifications(broadcast_id) where broadcast_id is not null;

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications" on public.notifications
  for select using (auth.uid() = user_id);

-- Only the read flag is user-writable; the row itself is created server-side.
drop policy if exists "Users can mark own notifications read" on public.notifications;
create policy "Users can mark own notifications read" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

-- Live feed updates for the notifications screen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

-- ────────────────────────────────────────────
-- Dispatch: notification row → Edge Function → Expo push
--
-- The project URL and service role key live in Supabase Vault under the names
-- `project_url` and `service_role_key`. See the setup block at the bottom of
-- this file. (Vault rather than `alter database ... set`: the `postgres` role
-- is not superuser on Supabase and cannot set custom database parameters.)
-- ────────────────────────────────────────────
create or replace function public.dispatch_push_notification()
returns trigger as $$
declare
  project_url text;
  service_key text;
begin
  -- Part of a fan-out. dispatch_broadcast_push() sends the whole batch in one
  -- call, so a per-row http_post here would be N duplicate requests.
  if new.broadcast_id is not null then
    return new;
  end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'project_url' limit 1;

  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  -- Secrets not configured yet (e.g. local dev) — the feed row still stands,
  -- there is just no push for it.
  if project_url is null or service_key is null then
    return new;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('notification_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public, net;

drop trigger if exists on_notification_created_send_push on public.notifications;
create trigger on_notification_created_send_push
after insert on public.notifications
for each row
execute function public.dispatch_push_notification();

-- ────────────────────────────────────────────
-- Dispatch: one Edge Function call for a whole fan-out batch.
--
-- A tournament announcement can touch every user on the platform. Firing the
-- per-row trigger for each would mean thousands of pg_net requests; this sends
-- the batch id once and lets the function page through the rows.
-- ────────────────────────────────────────────
create or replace function public.dispatch_broadcast_push(p_broadcast_id uuid)
returns void as $$
declare
  project_url text;
  service_key text;
begin
  if p_broadcast_id is null then
    return;
  end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'project_url' limit 1;

  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if project_url is null or service_key is null then
    return;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('broadcast_id', p_broadcast_id),
    -- Longer than the single-row path: the function may send thousands of messages.
    timeout_milliseconds := 30000
  );
end;
$$ language plpgsql security definer set search_path = public, net;

-- ────────────────────────────────────────────
-- Helper: insert a notification (bypasses RLS via security definer)
-- ────────────────────────────────────────────
create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_tournament_id uuid default null,
  p_match_id uuid default null,
  p_data jsonb default '{}'::jsonb
)
returns uuid as $$
declare
  new_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, tournament_id, match_id, data)
  values (p_user_id, p_type, p_title, p_body, p_tournament_id, p_match_id, p_data)
  returning id into new_id;

  return new_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ────────────────────────────────────────────
-- Trigger: registration status decided → notify the player
--          registration created        → notify the organizer
-- ────────────────────────────────────────────
create or replace function public.notify_on_registration_change()
returns trigger as $$
declare
  t_title text;
  c_name text;
  organizer uuid;
  player_name text;
begin
  select t.title, t.organizer_id into t_title, organizer
  from public.tournaments t where t.id = new.tournament_id;

  select tc.name into c_name
  from public.tournament_categories tc where tc.id = new.category_id;

  if tg_op = 'INSERT' then
    -- The organizer added this entry from the roster screen — they already know.
    if auth.uid() = organizer then
      return new;
    end if;

    select p.name into player_name from public.profiles p where p.id = new.user_id;

    perform public.create_notification(
      organizer,
      'registration_received',
      'New registration',
      coalesce(player_name, 'A player') || ' registered for ' || coalesce(c_name, 'a category') ||
        ' in ' || coalesce(t_title, 'your tournament') || '.',
      new.tournament_id,
      null,
      jsonb_build_object('registration_id', new.id, 'category_id', new.category_id)
    );

    return new;
  end if;

  -- UPDATE: only fire when the decision actually changed.
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'approved' then
    perform public.create_notification(
      new.user_id,
      'registration_approved',
      'Registration approved',
      'You are in for ' || coalesce(c_name, 'your category') || ' at ' ||
        coalesce(t_title, 'the tournament') || '. Good luck!',
      new.tournament_id,
      null,
      jsonb_build_object('registration_id', new.id, 'category_id', new.category_id)
    );
  elsif new.status = 'rejected' then
    perform public.create_notification(
      new.user_id,
      'registration_rejected',
      'Registration declined',
      'Your entry for ' || coalesce(c_name, 'a category') || ' at ' ||
        coalesce(t_title, 'the tournament') || ' was not accepted.',
      new.tournament_id,
      null,
      jsonb_build_object('registration_id', new.id, 'category_id', new.category_id)
    );
  elsif new.status = 'waitlisted' then
    perform public.create_notification(
      new.user_id,
      'registration_waitlisted',
      'You are on the waitlist',
      'You have been waitlisted for ' || coalesce(c_name, 'a category') || ' at ' ||
        coalesce(t_title, 'the tournament') || '. We will let you know if a spot opens.',
      new.tournament_id,
      null,
      jsonb_build_object('registration_id', new.id, 'category_id', new.category_id)
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_registration_change_notify on public.registrations;
create trigger on_registration_change_notify
after insert or update of status on public.registrations
for each row
execute function public.notify_on_registration_change();

-- ────────────────────────────────────────────
-- Trigger: match scheduled / result posted → notify both players
-- ────────────────────────────────────────────
create or replace function public.notify_on_match_change()
returns trigger as $$
declare
  t_title text;
  opponent_of_1 text := coalesce(new.player2_name, 'TBD');
  opponent_of_2 text := coalesce(new.player1_name, 'TBD');
  court_note text := '';
  result_line text;
begin
  select t.title into t_title from public.tournaments t where t.id = new.tournament_id;

  -- Match got a schedule (or the schedule moved).
  if new.scheduled_at is not null
     and (tg_op = 'INSERT' or old.scheduled_at is distinct from new.scheduled_at) then

    if new.court_number is not null then
      court_note := ' on court ' || new.court_number;
    end if;

    perform public.create_notification(
      new.player1_id,
      'match_scheduled',
      'Match scheduled',
      'You play ' || opponent_of_1 || court_note || ' at ' ||
        to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') ||
        ' — ' || coalesce(t_title, 'tournament') || '.',
      new.tournament_id,
      new.id,
      jsonb_build_object('round', new.round, 'match_number', new.match_number)
    );

    perform public.create_notification(
      new.player2_id,
      'match_scheduled',
      'Match scheduled',
      'You play ' || opponent_of_2 || court_note || ' at ' ||
        to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') ||
        ' — ' || coalesce(t_title, 'tournament') || '.',
      new.tournament_id,
      new.id,
      jsonb_build_object('round', new.round, 'match_number', new.match_number)
    );
  end if;

  -- Result posted.
  if tg_op = 'UPDATE'
     and new.status in ('completed', 'walkover')
     and old.status is distinct from new.status then

    result_line := coalesce(new.winner_name, 'The winner') || ' won' ||
      case when new.score is not null then ' (' || new.score || ')' else '' end || '.';

    perform public.create_notification(
      new.player1_id,
      'match_result',
      'Result posted',
      result_line || ' — ' || coalesce(t_title, 'tournament'),
      new.tournament_id,
      new.id,
      jsonb_build_object('winner_id', new.winner_id, 'score', new.score)
    );

    perform public.create_notification(
      new.player2_id,
      'match_result',
      'Result posted',
      result_line || ' — ' || coalesce(t_title, 'tournament'),
      new.tournament_id,
      new.id,
      jsonb_build_object('winner_id', new.winner_id, 'score', new.score)
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_match_change_notify on public.matches;
create trigger on_match_change_notify
after insert or update of status, scheduled_at on public.matches
for each row
execute function public.notify_on_match_change();

-- ────────────────────────────────────────────
-- Trigger: tournament status changed → notify approved players
-- ────────────────────────────────────────────
create or replace function public.notify_on_tournament_status()
returns trigger as $$
declare
  headline text;
  detail text;
  batch_id uuid := uuid_generate_v4();
  inserted int;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  case new.status
    when 'open' then
      headline := 'Registrations open';
      detail := new.title || ' is now accepting entries.';
    when 'ongoing' then
      headline := 'Tournament started';
      detail := new.title || ' has begun. Check your match schedule.';
    when 'paused' then
      headline := 'Tournament paused';
      detail := new.title || ' has been paused by the organizer.';
    when 'completed' then
      headline := 'Tournament completed';
      detail := new.title || ' has wrapped up. Final results are available.';
    when 'cancelled' then
      headline := 'Tournament cancelled';
      detail := new.title || ' has been cancelled by the organizer.';
    else
      return new;
  end case;

  insert into public.notifications (user_id, type, title, body, tournament_id, data, broadcast_id)
  select distinct r.user_id,
         'tournament_status',
         headline,
         detail,
         new.id,
         jsonb_build_object('status', new.status),
         batch_id
  from public.registrations r
  where r.tournament_id = new.id
    and r.status in ('approved', 'waitlisted')
    and r.user_id is not null;

  get diagnostics inserted = row_count;
  if inserted > 0 then
    perform public.dispatch_broadcast_push(batch_id);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_tournament_status_notify on public.tournaments;
create trigger on_tournament_status_notify
after update of status on public.tournaments
for each row
execute function public.notify_on_tournament_status();

-- ────────────────────────────────────────────
-- Trigger: a tournament opens for entries → tell everyone on the platform
--
-- This is the only notification that is not scoped to people already involved
-- with the tournament, so it is deliberately once-per-tournament: `announced_at`
-- is stamped on the first send and every later draft→open flip is a no-op.
-- ────────────────────────────────────────────
alter table public.tournaments add column if not exists announced_at timestamptz;

create or replace function public.notify_on_tournament_published()
returns trigger as $$
declare
  batch_id uuid := uuid_generate_v4();
  inserted int;
begin
  if new.status <> 'open' or new.announced_at is not null then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, tournament_id, data, broadcast_id)
  select p.id,
         'tournament_published',
         'New tournament: ' || new.title,
         'Entries are open for ' || new.title || ' in ' || new.city || ', ' || new.state ||
           ' — registrations close ' || to_char(new.registration_deadline, 'DD Mon') || '.',
         new.id,
         jsonb_build_object('city', new.city, 'state', new.state),
         batch_id
  from public.profiles p
  where p.id <> new.organizer_id;

  get diagnostics inserted = row_count;
  if inserted > 0 then
    perform public.dispatch_broadcast_push(batch_id);
  end if;

  -- Only touches announced_at, so `after ... update of status` does not re-fire.
  update public.tournaments set announced_at = now() where id = new.id;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_tournament_published_notify on public.tournaments;
create trigger on_tournament_published_notify
after insert or update of status on public.tournaments
for each row
execute function public.notify_on_tournament_published();

-- ────────────────────────────────────────────
-- Bulk helper: organizer announcement to everyone in a tournament
-- ────────────────────────────────────────────
create or replace function public.send_tournament_announcement(
  p_tournament_id uuid,
  p_title text,
  p_body text
)
returns int as $$
declare
  sent int := 0;
  batch_id uuid := uuid_generate_v4();
begin
  if not exists (
    select 1 from public.tournaments t
    where t.id = p_tournament_id and t.organizer_id = auth.uid()
  ) and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only the organizer or an admin can send announcements';
  end if;

  insert into public.notifications (user_id, type, title, body, tournament_id, broadcast_id)
  select distinct r.user_id, 'announcement', p_title, p_body, p_tournament_id, batch_id
  from public.registrations r
  where r.tournament_id = p_tournament_id
    and r.status in ('approved', 'waitlisted')
    and r.user_id is not null;

  get diagnostics sent = row_count;
  if sent > 0 then
    perform public.dispatch_broadcast_push(batch_id);
  end if;

  return sent;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.send_tournament_announcement(uuid, text, text) to authenticated;

-- ────────────────────────────────────────────
-- Mark-all-read helper
-- ────────────────────────────────────────────
create or replace function public.mark_all_notifications_read()
returns int as $$
declare
  updated_count int;
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.mark_all_notifications_read() to authenticated;

-- ────────────────────────────────────────────
-- Required one-time config for push dispatch.
--
-- Store the project URL and service role key in Vault. Run this once, with your
-- own key substituted — never commit the real key to this file.
-- (Service role key = full RLS bypass. Server-side only, never in the app bundle.)
-- ────────────────────────────────────────────
-- select vault.create_secret(
--   'https://xkbueqxpmebngjflziwr.supabase.co',
--   'project_url',
--   'SmashDraw Supabase project URL'
-- );
--
-- select vault.create_secret(
--   'YOUR_SERVICE_ROLE_KEY',
--   'service_role_key',
--   'Used by dispatch_push_notification() to invoke the send-push function'
-- );
--
-- Rotating the key later — update in place rather than creating a duplicate:
-- select vault.update_secret(
--   (select id from vault.decrypted_secrets where name = 'service_role_key'),
--   'NEW_SERVICE_ROLE_KEY'
-- );
