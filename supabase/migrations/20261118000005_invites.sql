-- Pre-approved people: admins list someone's email with their role, whether
-- they sign off invoices, and (for contractors) their hourly rate. When that
-- person signs up AND confirms their email, they get that setup straight away
-- instead of waiting as "pending". Applying it only on a confirmed email means
-- nobody can claim someone else's invite without access to their inbox.

create table public.invites (
  email         text primary key check (email = lower(trim(email)) and email like '%_@_%'),
  name          text not null default '',
  role          text not null default 'volunteer' check (role in ('admin', 'volunteer')),
  can_sign_off  boolean not null default false,
  hourly_rate   numeric(6, 2) check (hourly_rate is null or hourly_rate >= 0),
  invited_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  used_at       timestamptz,
  used_by       uuid references public.profiles (id) on delete set null
);

alter table public.invites enable row level security;
create policy "invites: admins only"
  on public.invites for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.apply_invite(p_user uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites
   where email = lower(trim(p_email)) and used_at is null
   for update;
  if not found then
    return;
  end if;

  update public.profiles
     set role = case when role = 'admin' then 'admin' else inv.role end, -- never demote the first admin
         can_sign_off = can_sign_off or inv.can_sign_off,
         name = case when coalesce(trim(name), '') = '' or name = split_part(p_email, '@', 1) then coalesce(nullif(inv.name, ''), name) else name end
   where id = p_user;

  if inv.hourly_rate is not null then
    insert into public.contractor_rates (user_id, hourly_rate) values (p_user, inv.hourly_rate)
    on conflict (user_id) do update set hourly_rate = excluded.hourly_rate;
  end if;

  update public.invites set used_at = now(), used_by = p_user where email = inv.email;
end;
$$;
revoke execute on function public.apply_invite(uuid, text) from public, anon, authenticated;

-- New sign-ups: create the profile as before, then apply an invite if the
-- email is already confirmed (e.g. confirmations switched off).
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

  if new.email_confirmed_at is not null then
    perform public.apply_invite(new.id, new.email);
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Email confirmed later (the normal case): apply the invite then.
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_invite(new.id, new.email);
  return new;
end;
$$;
revoke execute on function public.handle_user_confirmed() from public, anon, authenticated;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();
