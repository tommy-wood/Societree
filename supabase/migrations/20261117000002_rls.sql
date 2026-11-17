-- Societree Forest Care: Row Level Security.
--
-- Rules (CLAUDE.md):
--   * Any signed-in user can read everything, log visits, add/tick jobs, add
--     photos and change stock quantities.
--   * Only admins can add/delete sites, delete visits and manage users.
--
-- Decisions beyond the brief, kept deliberately loose for a small trusted team:
--   * Any signed-in user can UPDATE a site (needed for "Set location to here"
--     GPS capture and fixing addresses/notes in the field).
--   * Any signed-in user can add stock items (the prototype lets them);
--     only admins delete stock items.
--   * People can edit their own visits; admins can edit anyone's.
--   * Anonymous (signed-out) users get nothing.

-- Internal helper must not be callable through the API.
revoke execute on function public.recompute_site_from_visits(uuid) from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

alter table public.profiles     enable row level security;
alter table public.sites        enable row level security;
alter table public.visits       enable row level security;
alter table public.visit_photos enable row level security;
alter table public.jobs         enable row level security;
alter table public.stock_items  enable row level security;
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------- profiles
-- Rows are created by the auth trigger; nobody inserts directly.
create policy "profiles: signed-in users can read"
  on public.profiles for select to authenticated using (true);

create policy "profiles: update own name, admins update anyone"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
-- Role changes are additionally blocked for non-admins by the profiles_guard_role trigger.

create policy "profiles: admins can delete"
  on public.profiles for delete to authenticated
  using ((select public.is_admin()));

-- ------------------------------------------------------------------- sites
create policy "sites: signed-in users can read"
  on public.sites for select to authenticated using (true);

create policy "sites: admins can add"
  on public.sites for insert to authenticated
  with check ((select public.is_admin()));

create policy "sites: signed-in users can update"
  on public.sites for update to authenticated
  using (true) with check (true);

create policy "sites: admins can delete"
  on public.sites for delete to authenticated
  using ((select public.is_admin()));

-- ------------------------------------------------------------------ visits
create policy "visits: signed-in users can read"
  on public.visits for select to authenticated using (true);

create policy "visits: signed-in users log their own"
  on public.visits for insert to authenticated
  with check (logged_by = (select auth.uid()));

create policy "visits: edit own, admins edit any"
  on public.visits for update to authenticated
  using (logged_by = (select auth.uid()) or (select public.is_admin()))
  with check (logged_by = (select auth.uid()) or (select public.is_admin()));

create policy "visits: admins can delete"
  on public.visits for delete to authenticated
  using ((select public.is_admin()));

-- ------------------------------------------------------------ visit_photos
create policy "visit_photos: signed-in users can read"
  on public.visit_photos for select to authenticated using (true);

create policy "visit_photos: signed-in users can add"
  on public.visit_photos for insert to authenticated
  with check (uploaded_by = (select auth.uid()));

create policy "visit_photos: uploader or admin can delete"
  on public.visit_photos for delete to authenticated
  using (uploaded_by = (select auth.uid()) or (select public.is_admin()));

-- -------------------------------------------------------------------- jobs
create policy "jobs: signed-in users can read"
  on public.jobs for select to authenticated using (true);

create policy "jobs: signed-in users can add"
  on public.jobs for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "jobs: signed-in users can update (tick off)"
  on public.jobs for update to authenticated
  using (true) with check (true);

create policy "jobs: creator or admin can delete"
  on public.jobs for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

-- ------------------------------------------------------------- stock_items
create policy "stock: signed-in users can read"
  on public.stock_items for select to authenticated using (true);

create policy "stock: signed-in users can add"
  on public.stock_items for insert to authenticated
  with check (true);

create policy "stock: signed-in users can update"
  on public.stock_items for update to authenticated
  using (true) with check (true);

create policy "stock: admins can delete"
  on public.stock_items for delete to authenticated
  using ((select public.is_admin()));

-- ------------------------------------------------------------ app_settings
create policy "settings: signed-in users can read"
  on public.app_settings for select to authenticated using (true);

create policy "settings: admins can change"
  on public.app_settings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
