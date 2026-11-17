-- Societree Forest Care: core schema.
-- Tables, constraints, and the triggers that keep derived data (sites.last_visit,
-- sites.priority, profiles, job completion) in step. Row Level Security lives in
-- the next migration.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  role        text not null default 'volunteer' check (role in ('admin', 'volunteer')),
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'App users. The first user to sign up becomes admin.';

-- ---------------------------------------------------------------------------
-- sites: the community forests
-- ---------------------------------------------------------------------------
create table public.sites (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique,              -- stable key from the Base44 import; optional for new sites
  name           text not null check (length(trim(name)) > 0),
  address        text not null default '',
  lat            double precision check (lat between -90 and 90),
  lng            double precision check (lng between -180 and 180),
  contact        text not null default '',
  contact_email  text not null default '',
  notes          text not null default '',
  priority       text check (priority in ('low', 'medium', 'urgent')),  -- null = never assessed
  last_visit     date,                     -- maintained by the visits trigger
  created_at     timestamptz not null default now()
);

create index sites_name_idx on public.sites (lower(name));

-- ---------------------------------------------------------------------------
-- visits: one row per logged visit (or observation)
-- ---------------------------------------------------------------------------
create table public.visits (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites (id) on delete cascade,
  date                date not null default current_date,
  priority_at_visit   text check (priority_at_visit in ('low', 'medium', 'urgent')),
  work_carried_out    text not null default '',
  notes               text not null default '',
  logged_by           uuid references public.profiles (id) on delete set null default auth.uid(),
  legacy_logged_by    text,                -- free-text name from the Base44 export
  legacy_photo_count  integer not null default 0 check (legacy_photo_count >= 0),
  created_at          timestamptz not null default now()
);

create index visits_site_date_idx on public.visits (site_id, date desc, created_at desc);
create index visits_logged_by_idx on public.visits (logged_by);

-- ---------------------------------------------------------------------------
-- visit_photos: files in the "visit-photos" storage bucket
-- ---------------------------------------------------------------------------
create table public.visit_photos (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references public.visits (id) on delete cascade,
  storage_path  text not null unique,
  uploaded_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);

create index visit_photos_visit_idx on public.visit_photos (visit_id);

-- ---------------------------------------------------------------------------
-- jobs: per-site to-do list
-- ---------------------------------------------------------------------------
create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.sites (id) on delete cascade,
  text          text not null check (length(trim(text)) > 0),
  done          boolean not null default false,
  due_date      date,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  completed_by  uuid references public.profiles (id) on delete set null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index jobs_site_idx on public.jobs (site_id, done);

-- ---------------------------------------------------------------------------
-- stock_items
-- ---------------------------------------------------------------------------
create table public.stock_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  quantity    integer not null default 0 check (quantity >= 0),
  unit        text not null default '',    -- free text: "rolls", "20 litres", "20m²", ...
  low_at      integer not null default 0 check (low_at >= 0),  -- 0 = no low-stock warning
  kept_at     text not null default '',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- app_settings: small key/value store for things like the overdue threshold
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value) values ('overdue_days', '35');

-- ===========================================================================
-- Helper: is the current user an admin?
-- security definer so it can read profiles without tripping profiles' own RLS.
-- ===========================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ===========================================================================
-- New auth user -> profile. The first user becomes admin.
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_first boolean;
begin
  -- Serialise sign-ups so two people signing up at once can't both become admin.
  perform pg_advisory_xact_lock(hashtext('societree.handle_new_user'));
  select not exists (select 1 from public.profiles) into is_first;

  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), ''),
    case when is_first then 'admin' else 'volunteer' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change anyone's role (including their own).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null           -- service role / SQL editor have no auth.uid()
     and not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if new.id is distinct from old.id then
    raise exception 'Profile id cannot change' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ===========================================================================
-- Visits -> sites.priority / sites.last_visit
--
-- Rule (CLAUDE.md): a new visit sets the site's priority and last_visit, but
-- only if the visit is the newest (same-day visits count as newer, so the most
-- recently logged one wins). Editing or deleting a visit recomputes the site
-- from its latest remaining visit.
-- ===========================================================================
create or replace function public.recompute_site_from_visits(p_site_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  -- If no visits remain, last_visit becomes null and priority is left as is.
  with latest as (
    select v.date, v.priority_at_visit
      from public.visits v
     where v.site_id = p_site_id
     order by v.date desc, v.created_at desc
     limit 1
  )
  update public.sites s
     set last_visit = (select date from latest),
         priority   = coalesce((select priority_at_visit from latest), s.priority)
   where s.id = p_site_id;
$$;

create or replace function public.visits_sync_site()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.sites
       set last_visit = new.date,
           priority   = coalesce(new.priority_at_visit, priority)
     where id = new.site_id
       and (last_visit is null or new.date >= last_visit);
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.recompute_site_from_visits(new.site_id);
    if old.site_id is distinct from new.site_id then
      perform public.recompute_site_from_visits(old.site_id);
    end if;
    return new;
  else -- DELETE
    perform public.recompute_site_from_visits(old.site_id);
    return old;
  end if;
end;
$$;

create trigger visits_sync_site_ins
  after insert on public.visits
  for each row execute function public.visits_sync_site();

create trigger visits_sync_site_upd
  after update of site_id, date, priority_at_visit on public.visits
  for each row execute function public.visits_sync_site();

create trigger visits_sync_site_del
  after delete on public.visits
  for each row execute function public.visits_sync_site();

-- ===========================================================================
-- Jobs: stamp who completed a job and when.
-- ===========================================================================
create or replace function public.jobs_stamp_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.done and not coalesce(old.done, false) then
    new.completed_by := auth.uid();
    new.completed_at := now();
  elsif not new.done then
    new.completed_by := null;
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger jobs_stamp_completion
  before insert or update of done on public.jobs
  for each row execute function public.jobs_stamp_completion();

-- ===========================================================================
-- updated_at helpers
-- ===========================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger stock_items_touch before update on public.stock_items
  for each row execute function public.touch_updated_at();
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();
