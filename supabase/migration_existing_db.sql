-- SmashDraw incremental migration for an existing Supabase database.
-- Run this instead of rerunning schema.sql if your tables already exist.

alter table public.tournaments add column if not exists venue_latitude double precision;
alter table public.tournaments add column if not exists venue_longitude double precision;
alter table public.tournaments add column if not exists venue_map_url text;
alter table public.tournaments add column if not exists contact_phone_2 text;
alter table public.tournaments add column if not exists contact_phone_3 text;
alter table public.tournaments add column if not exists payment_address text;

alter table public.tournaments drop constraint if exists tournaments_status_check;
alter table public.tournaments
  add constraint tournaments_status_check
  check (status in ('draft','open','ongoing','paused','completed','cancelled'));

alter table public.matches add column if not exists winner_name text;
alter table public.matches add column if not exists player1_score int;
alter table public.matches add column if not exists player2_score int;
alter table public.matches add column if not exists result_notes text;
alter table public.matches add column if not exists prize_money_received int;
alter table public.matches add column if not exists completed_at timestamptz;
alter table public.matches add column if not exists result_uploaded_by uuid references public.profiles(id);

drop policy if exists "Organizers can delete own tournaments" on public.tournaments;
create policy "Organizers can delete own tournaments" on public.tournaments
  for delete using (auth.uid() = organizer_id);

drop policy if exists "Admins can view all tournaments" on public.tournaments;
create policy "Admins can view all tournaments" on public.tournaments
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update all tournaments" on public.tournaments;
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

drop policy if exists "Admins can view all registrations" on public.registrations;
create policy "Admins can view all registrations" on public.registrations
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Players can register" on public.registrations;
drop policy if exists "Players can register for open tournaments" on public.registrations;
create policy "Players can register for open tournaments" on public.registrations
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.status = 'open'
    )
  );

drop policy if exists "Players can update own registration" on public.registrations;
drop policy if exists "Organizers can update tournament registrations" on public.registrations;
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

drop policy if exists "Admins can update all registrations" on public.registrations;
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

alter table public.registrations alter column status set default 'pending';

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

drop trigger if exists on_registration_created_increment_category on public.registrations;
drop trigger if exists on_registration_changed_sync_category on public.registrations;
create trigger on_registration_created_increment_category
after insert or delete or update of category_id, status on public.registrations
for each row
execute function public.sync_category_registration_count();

update public.tournament_categories c
set current_players = (
  select count(*)::int
  from public.registrations r
  where r.category_id = c.id
    and r.status = 'approved'
);

drop policy if exists "Admins can manage matches" on public.matches;
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
