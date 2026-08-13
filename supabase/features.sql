-- SmashDraw — organizer roster entries + draw support
-- Run this in your Supabase SQL editor after schema.sql and notifications.sql.
-- Re-runnable.
--
-- What this adds:
--   1. Organizers can put a player/team on the roster themselves, including
--      walk-ins who have no SmashDraw account (registrations.user_id goes null).
--   2. An RPC to announce a published draw to the players in a category.
--
-- The draw itself (random pairing, byes, later rounds) is generated client-side
-- in src/lib/draw.ts and written straight to `matches` — organizers already hold
-- full write access there through the "Organizers can manage matches" policy.

-- ────────────────────────────────────────────
-- 1. Roster entries added by the organizer
--
-- A walk-in has no account, so user_id becomes optional and the display name
-- lives in `notes` (same JSON shape the registration sheet writes). `added_by`
-- records who put them there, and is what separates an organizer-created entry
-- from a real player registration.
-- ────────────────────────────────────────────
alter table public.registrations alter column user_id drop not null;

alter table public.registrations
  add column if not exists added_by uuid references public.profiles(id) on delete set null;

create index if not exists registrations_added_by_idx
  on public.registrations(added_by) where added_by is not null;

-- The app goes through add_tournament_entry() below, which is security definer
-- and so bypasses RLS. These policies cover the direct-table case: an organizer
-- writing from the dashboard, or a future client that inserts without the RPC.
drop policy if exists "Organizers can add entries" on public.registrations;
create policy "Organizers can add entries" on public.registrations
  for insert with check (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.organizer_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Deliberately narrow: only entries the organizer created themselves. A real
-- player's registration is declined via set_registration_status, never deleted.
drop policy if exists "Organizers can delete entries they added" on public.registrations;
create policy "Organizers can delete entries they added" on public.registrations
  for delete using (
    added_by is not null
    and (
      exists (
        select 1 from public.tournaments t
        where t.id = tournament_id and t.organizer_id = auth.uid()
      )
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    )
  );

create or replace function public.add_tournament_entry(
  p_tournament_id uuid,
  p_category_id uuid,
  p_player_name text,
  p_partner_name text default null,
  p_phone text default null,
  p_email text default null,
  p_user_id uuid default null,
  p_notes text default null
)
returns uuid as $$
declare
  new_id uuid;
  clean_name text := nullif(btrim(p_player_name), '');
begin
  if not exists (
    select 1 from public.tournaments t
    where t.id = p_tournament_id and t.organizer_id = auth.uid()
  ) and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only the organizer or an admin can add entries';
  end if;

  if clean_name is null then
    raise exception 'A player or team name is required';
  end if;

  if not exists (
    select 1 from public.tournament_categories c
    where c.id = p_category_id and c.tournament_id = p_tournament_id
  ) then
    raise exception 'That category does not belong to this tournament';
  end if;

  -- Linking to a real account is optional, but the account must not already
  -- hold an entry in the category (the unique constraint would reject it with a
  -- much less helpful message).
  if p_user_id is not null and exists (
    select 1 from public.registrations r
    where r.user_id = p_user_id and r.category_id = p_category_id
  ) then
    raise exception 'That player already has an entry in this category';
  end if;

  -- Capacity is not enforced here on purpose: an organizer adding a walk-in at
  -- the venue is the authority on whether the category can take one more.
  insert into public.registrations (
    user_id, tournament_id, category_id, status, added_by, notes
  )
  values (
    p_user_id,
    p_tournament_id,
    p_category_id,
    'approved',
    auth.uid(),
    jsonb_build_object(
      'playerName', clean_name,
      'partnerName', nullif(btrim(coalesce(p_partner_name, '')), ''),
      'phone', nullif(btrim(coalesce(p_phone, '')), ''),
      'email', nullif(btrim(coalesce(p_email, '')), ''),
      'notes', nullif(btrim(coalesce(p_notes, '')), ''),
      'addedByOrganizer', true
    )::text
  )
  returning id into new_id;

  return new_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.add_tournament_entry(
  uuid, uuid, text, text, text, text, uuid, text
) to authenticated;

create or replace function public.remove_tournament_entry(p_registration_id uuid)
returns boolean as $$
declare
  removed int;
begin
  delete from public.registrations r
  where r.id = p_registration_id
    and r.added_by is not null
    and (
      exists (
        select 1 from public.tournaments t
        where t.id = r.tournament_id and t.organizer_id = auth.uid()
      )
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin'
      )
    );

  get diagnostics removed = row_count;
  return removed > 0;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.remove_tournament_entry(uuid) to authenticated;

-- ────────────────────────────────────────────
-- 2. Announce a published draw
--
-- Called after the organizer generates or regenerates a category draw. Goes to
-- the approved players in that category only — walk-in entries have no account
-- and are silently skipped.
-- ────────────────────────────────────────────
create or replace function public.notify_draw_published(
  p_tournament_id uuid,
  p_category_id uuid
)
returns int as $$
declare
  sent int := 0;
  batch_id uuid := uuid_generate_v4();
  t_title text;
  c_name text;
begin
  if not exists (
    select 1 from public.tournaments t
    where t.id = p_tournament_id and t.organizer_id = auth.uid()
  ) and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only the organizer or an admin can publish a draw';
  end if;

  select t.title into t_title from public.tournaments t where t.id = p_tournament_id;
  select c.name into c_name from public.tournament_categories c where c.id = p_category_id;

  insert into public.notifications (user_id, type, title, body, tournament_id, data, broadcast_id)
  select distinct r.user_id,
         'announcement',
         'Draw is out',
         'The ' || coalesce(c_name, 'category') || ' draw for ' ||
           coalesce(t_title, 'the tournament') || ' has been published. Check your first match.',
         p_tournament_id,
         jsonb_build_object('category_id', p_category_id),
         batch_id
  from public.registrations r
  where r.tournament_id = p_tournament_id
    and r.category_id = p_category_id
    and r.status = 'approved'
    and r.user_id is not null;

  get diagnostics sent = row_count;
  if sent > 0 then
    perform public.dispatch_broadcast_push(batch_id);
  end if;

  return sent;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.notify_draw_published(uuid, uuid) to authenticated;
