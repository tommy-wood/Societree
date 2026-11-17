-- Admin approval for new accounts.
--
-- New sign-ups get role 'pending' and can see nothing except their own
-- profile until an admin makes them a volunteer (or admin). The first user
-- still becomes admin automatically. All policies that used to allow any
-- signed-in user now require an approved member.

-- ---------------------------------------------------------------- roles
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'volunteer', 'pending'));
alter table public.profiles alter column role set default 'pending';

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'volunteer')
  );
$$;

revoke execute on function public.is_member() from public, anon;
grant  execute on function public.is_member() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_first boolean;
begin
  perform pg_advisory_xact_lock(hashtext('societree.handle_new_user'));
  select not exists (select 1 from public.profiles) into is_first;

  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), ''),
    case when is_first then 'admin' else 'pending' end
  );
  return new;
end;
$$;

-- Role guard: only admins change roles, and the last admin can't be removed.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Profile id cannot change' using errcode = '42501';
    end if;
    if new.role is distinct from old.role
       and auth.uid() is not null
       and not public.is_admin() then
      raise exception 'Only admins can change roles' using errcode = '42501';
    end if;
  end if;

  -- In-app only: the dashboard / service role (no auth.uid()) can still remove anyone.
  if old.role = 'admin'
     and auth.uid() is not null
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (
       select 1 from public.profiles where role = 'admin' and id <> old.id
     ) then
    raise exception 'There must always be at least one admin' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update or delete on public.profiles
  for each row execute function public.guard_profile_role();

-- Admin-only: attribute the imported Base44 visits for a legacy name
-- ("Thomas Woodward", "tommysocietree", ...) to a real profile.
create or replace function public.link_legacy_visits(p_legacy_name text, p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can link old visits' using errcode = '42501';
  end if;
  update public.visits
     set logged_by = p_profile_id
   where legacy_logged_by = p_legacy_name
     and logged_by is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.link_legacy_visits(text, uuid) from public, anon;
grant  execute on function public.link_legacy_visits(text, uuid) to authenticated;

-- ------------------------------------------------------- policies: replace
drop policy "profiles: signed-in users can read" on public.profiles;
create policy "profiles: members read all, pending read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_member()));

drop policy "sites: signed-in users can read" on public.sites;
drop policy "sites: signed-in users can update" on public.sites;
create policy "sites: members can read"
  on public.sites for select to authenticated using ((select public.is_member()));
create policy "sites: members can update"
  on public.sites for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

drop policy "visits: signed-in users can read" on public.visits;
drop policy "visits: signed-in users log their own" on public.visits;
drop policy "visits: edit own, admins edit any" on public.visits;
create policy "visits: members can read"
  on public.visits for select to authenticated using ((select public.is_member()));
create policy "visits: members log their own"
  on public.visits for insert to authenticated
  with check ((select public.is_member()) and logged_by = (select auth.uid()));
create policy "visits: members edit own, admins edit any"
  on public.visits for update to authenticated
  using (((select public.is_member()) and logged_by = (select auth.uid())) or (select public.is_admin()))
  with check (((select public.is_member()) and logged_by = (select auth.uid())) or (select public.is_admin()));

drop policy "visit_photos: signed-in users can read" on public.visit_photos;
drop policy "visit_photos: signed-in users can add" on public.visit_photos;
drop policy "visit_photos: uploader or admin can delete" on public.visit_photos;
create policy "visit_photos: members can read"
  on public.visit_photos for select to authenticated using ((select public.is_member()));
create policy "visit_photos: members can add"
  on public.visit_photos for insert to authenticated
  with check ((select public.is_member()) and uploaded_by = (select auth.uid()));
create policy "visit_photos: uploader or admin can delete"
  on public.visit_photos for delete to authenticated
  using (((select public.is_member()) and uploaded_by = (select auth.uid())) or (select public.is_admin()));

drop policy "jobs: signed-in users can read" on public.jobs;
drop policy "jobs: signed-in users can add" on public.jobs;
drop policy "jobs: signed-in users can update (tick off)" on public.jobs;
drop policy "jobs: creator or admin can delete" on public.jobs;
create policy "jobs: members can read"
  on public.jobs for select to authenticated using ((select public.is_member()));
create policy "jobs: members can add"
  on public.jobs for insert to authenticated
  with check ((select public.is_member()) and created_by = (select auth.uid()));
create policy "jobs: members can update (tick off)"
  on public.jobs for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));
create policy "jobs: creator or admin can delete"
  on public.jobs for delete to authenticated
  using (((select public.is_member()) and created_by = (select auth.uid())) or (select public.is_admin()));

drop policy "stock: signed-in users can read" on public.stock_items;
drop policy "stock: signed-in users can add" on public.stock_items;
drop policy "stock: signed-in users can update" on public.stock_items;
create policy "stock: members can read"
  on public.stock_items for select to authenticated using ((select public.is_member()));
create policy "stock: members can add"
  on public.stock_items for insert to authenticated with check ((select public.is_member()));
create policy "stock: members can update"
  on public.stock_items for update to authenticated
  using ((select public.is_member())) with check ((select public.is_member()));

drop policy "settings: signed-in users can read" on public.app_settings;
create policy "settings: members can read"
  on public.app_settings for select to authenticated using ((select public.is_member()));

drop policy "visit-photos: signed-in users can view" on storage.objects;
drop policy "visit-photos: signed-in users can upload" on storage.objects;
create policy "visit-photos: members can view"
  on storage.objects for select to authenticated
  using (bucket_id = 'visit-photos' and (select public.is_member()));
create policy "visit-photos: members can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'visit-photos' and (select public.is_member()));
