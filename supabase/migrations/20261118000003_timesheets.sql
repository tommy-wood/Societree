-- Timesheets and monthly invoices for self-employed contractors.
--
-- * Contractors record each day's hours, miles and notes, plus materials
--   they bought (with an optional receipt photo).
-- * At month end they send an invoice; the database works out the totals
--   (hours x hourly rate + miles x mileage rate + materials, no VAT) and
--   locks that month so the figures can't change.
-- * Whoever "signs off invoices" (profiles.can_sign_off, e.g. the manager)
--   sees every contractor's hours and invoices and can sign off, send back
--   or mark as paid.
--
-- Privacy: hours, materials, receipts, invoices and bank details are visible
-- only to the contractor and the people who sign off invoices. Hourly rates
-- are also visible to admins, who (with sign-off people) can set them.

-- ------------------------------------------------------------ who signs off
alter table public.profiles add column can_sign_off boolean not null default false;

create or replace function public.is_finance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and can_sign_off and role in ('admin', 'volunteer')
  );
$$;

revoke execute on function public.is_finance() from public, anon;
grant  execute on function public.is_finance() to authenticated;

-- Extend the profile guard: only admins can change who signs off invoices.
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
    if (new.role is distinct from old.role or new.can_sign_off is distinct from old.can_sign_off)
       and auth.uid() is not null
       and not public.is_admin() then
      raise exception 'Only admins can change roles' using errcode = '42501';
    end if;
  end if;

  if old.role = 'admin'
     and auth.uid() is not null
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
    raise exception 'There must always be at least one admin' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

insert into public.app_settings (key, value) values ('mileage_rate', '0.45')
on conflict (key) do nothing;

-- ------------------------------------------------------------------ tables
create table public.contractor_rates (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  hourly_rate  numeric(6, 2) not null check (hourly_rate >= 0),
  updated_at   timestamptz not null default now()
);
comment on table public.contractor_rates is 'Hourly rate per contractor. Having a row here makes someone a contractor.';

create table public.contractor_details (
  user_id              uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  invoice_name         text not null default '',   -- name or trading name shown on invoices
  address              text not null default '',
  phone                text not null default '',
  email                text not null default '',
  bank_account_name    text not null default '',
  bank_sort_code       text not null default '',
  bank_account_number  text not null default '',
  updated_at           timestamptz not null default now()
);
comment on table public.contractor_details is 'Private: only the contractor and invoice sign-off people can read it.';

create table public.work_days (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  date         date not null,
  hours        numeric(4, 2) not null check (hours > 0 and hours <= 24),
  miles        numeric(6, 1) not null default 0 check (miles >= 0),
  description  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, date)
);

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  date          date not null,
  description   text not null check (length(trim(description)) > 0),
  amount        numeric(8, 2) not null check (amount > 0),
  receipt_path  text,
  created_at    timestamptz not null default now()
);

create sequence public.invoice_number_seq start 1001;

create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  month            date not null check (extract(day from month) = 1),
  number           text not null unique,
  status           text not null check (status in ('submitted', 'approved', 'paid', 'returned')),
  hourly_rate      numeric(6, 2) not null,
  hours            numeric(7, 2) not null,
  labour_total     numeric(10, 2) not null,
  mileage_rate     numeric(5, 2) not null,
  miles            numeric(8, 1) not null,
  mileage_total    numeric(10, 2) not null,
  materials_total  numeric(10, 2) not null,
  total            numeric(10, 2) not null,
  lines            jsonb not null,   -- snapshot of the days and materials
  contractor       jsonb not null,   -- snapshot of name, address and bank details
  submitted_at     timestamptz not null default now(),
  approved_at      timestamptz,
  approved_by      uuid references public.profiles (id) on delete set null,
  paid_at          timestamptz,
  returned_reason  text,
  unique (user_id, month)
);

create index work_days_user_date_idx on public.work_days (user_id, date);
create index expenses_user_date_idx on public.expenses (user_id, date);
create index invoices_month_idx on public.invoices (month, status);

create trigger contractor_rates_touch before update on public.contractor_rates
  for each row execute function public.touch_updated_at();
create trigger contractor_details_touch before update on public.contractor_details
  for each row execute function public.touch_updated_at();
create trigger work_days_touch before update on public.work_days
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------- lock invoiced months
create or replace function public.month_is_locked(p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invoices
    where user_id = p_user
      and month = date_trunc('month', p_date)::date
      and status in ('submitted', 'approved', 'paid')
  );
$$;
revoke execute on function public.month_is_locked(uuid, date) from public, anon, authenticated;

create or replace function public.guard_locked_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end; -- dashboard / service role
  end if;
  if tg_op in ('UPDATE', 'DELETE') and public.month_is_locked(old.user_id, old.date) then
    raise exception 'That month has been invoiced, so it can''t be changed. Ask for the invoice to be sent back first.' using errcode = '42501';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and public.month_is_locked(new.user_id, new.date) then
    raise exception 'That month has been invoiced, so it can''t be changed. Ask for the invoice to be sent back first.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger work_days_lock before insert or update or delete on public.work_days
  for each row execute function public.guard_locked_month();
create trigger expenses_lock before insert or update or delete on public.expenses
  for each row execute function public.guard_locked_month();

-- ------------------------------------------------------------------- RLS
alter table public.contractor_rates   enable row level security;
alter table public.contractor_details enable row level security;
alter table public.work_days          enable row level security;
alter table public.expenses           enable row level security;
alter table public.invoices           enable row level security;

create policy "rates: own, admins and sign-off can read"
  on public.contractor_rates for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or (select public.is_finance()));
create policy "rates: admins and sign-off can set"
  on public.contractor_rates for all to authenticated
  using ((select public.is_admin()) or (select public.is_finance()))
  with check ((select public.is_admin()) or (select public.is_finance()));

create policy "details: own and sign-off can read"
  on public.contractor_details for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_finance()));
create policy "details: own can add"
  on public.contractor_details for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_member()));
create policy "details: own can edit"
  on public.contractor_details for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "work_days: own and sign-off can read"
  on public.work_days for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_finance()));
create policy "work_days: own can add"
  on public.work_days for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_member()));
create policy "work_days: own can edit"
  on public.work_days for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "work_days: own can delete"
  on public.work_days for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "expenses: own and sign-off can read"
  on public.expenses for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_finance()));
create policy "expenses: own can add"
  on public.expenses for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_member()));
create policy "expenses: own can edit"
  on public.expenses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "expenses: own can delete"
  on public.expenses for delete to authenticated
  using (user_id = (select auth.uid()));

-- Invoices are only created and changed through the functions below.
create policy "invoices: own and sign-off can read"
  on public.invoices for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_finance()));

-- ------------------------------------------------------- receipts bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Path convention: <user_id>/<random>.jpg
create policy "receipts: own and sign-off can view"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_finance())));
create policy "receipts: own can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_member()));
create policy "receipts: own can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------- invoice actions
create or replace function public.submit_invoice(p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid        uuid := auth.uid();
  m          date := date_trunc('month', p_month)::date;
  existing   public.invoices;
  rate       numeric(6, 2);
  mrate      numeric(5, 2);
  v_hours    numeric(7, 2);
  v_miles    numeric(8, 1);
  v_mat      numeric(10, 2);
  v_lines    jsonb;
  v_who      jsonb;
  v_number   text;
  v_id       uuid;
begin
  if uid is null or not public.is_member() then
    raise exception 'Please sign in' using errcode = '42501';
  end if;
  if m > date_trunc('month', current_date)::date then
    raise exception 'You can''t invoice a future month' using errcode = '22023';
  end if;

  select * into existing from public.invoices where user_id = uid and month = m;
  if found and existing.status <> 'returned' then
    raise exception 'This month''s invoice has already been sent' using errcode = '23505';
  end if;

  select hourly_rate into rate from public.contractor_rates where user_id = uid;
  if rate is null then
    raise exception 'No hourly rate is set for you yet. Ask whoever signs off invoices to set it.' using errcode = '22023';
  end if;
  select coalesce((value #>> '{}')::numeric, 0.45) into mrate from public.app_settings where key = 'mileage_rate';
  mrate := coalesce(mrate, 0.45);

  select coalesce(sum(hours), 0), coalesce(sum(miles), 0) into v_hours, v_miles
    from public.work_days where user_id = uid and date_trunc('month', date)::date = m;
  select coalesce(sum(amount), 0) into v_mat
    from public.expenses where user_id = uid and date_trunc('month', date)::date = m;
  if v_hours = 0 and v_miles = 0 and v_mat = 0 then
    raise exception 'There''s nothing to invoice for this month yet' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('date', d.date, 'hours', d.hours, 'miles', d.miles, 'description', d.description) order by d.date)
                      from public.work_days d where d.user_id = uid and date_trunc('month', d.date)::date = m), '[]'::jsonb),
    'materials', coalesce((select jsonb_agg(jsonb_build_object('date', e.date, 'description', e.description, 'amount', e.amount) order by e.date, e.created_at)
                      from public.expenses e where e.user_id = uid and date_trunc('month', e.date)::date = m), '[]'::jsonb)
  ) into v_lines;

  select jsonb_build_object(
    'name', coalesce(nullif(cd.invoice_name, ''), p.name),
    'address', coalesce(cd.address, ''),
    'phone', coalesce(cd.phone, ''),
    'email', coalesce(nullif(cd.email, ''), u.email, ''),
    'bank_account_name', coalesce(cd.bank_account_name, ''),
    'bank_sort_code', coalesce(cd.bank_sort_code, ''),
    'bank_account_number', coalesce(cd.bank_account_number, '')
  ) into v_who
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.contractor_details cd on cd.user_id = p.id
  where p.id = uid;

  v_number := coalesce(existing.number, 'INV-' || nextval('public.invoice_number_seq'));

  insert into public.invoices as i (user_id, month, number, status, hourly_rate, hours, labour_total, mileage_rate, miles,
                                    mileage_total, materials_total, total, lines, contractor, submitted_at)
  values (uid, m, v_number, 'submitted', rate, v_hours, round(v_hours * rate, 2), mrate, v_miles,
          round(v_miles * mrate, 2), v_mat, round(v_hours * rate, 2) + round(v_miles * mrate, 2) + v_mat, v_lines, v_who, now())
  on conflict (user_id, month) do update set
    status = 'submitted', hourly_rate = excluded.hourly_rate, hours = excluded.hours, labour_total = excluded.labour_total,
    mileage_rate = excluded.mileage_rate, miles = excluded.miles, mileage_total = excluded.mileage_total,
    materials_total = excluded.materials_total, total = excluded.total, lines = excluded.lines,
    contractor = excluded.contractor, submitted_at = now(), approved_at = null, approved_by = null,
    paid_at = null, returned_reason = null
  returning i.id into v_id;
  return v_id;
end;
$$;

-- The contractor takes a sent (not yet signed off) invoice back to change it.
create or replace function public.withdraw_invoice(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invoices
     set status = 'returned', returned_reason = 'Taken back to make changes'
   where id = p_id and user_id = auth.uid() and status = 'submitted';
  if not found then
    raise exception 'Only a sent invoice that hasn''t been signed off can be taken back' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.review_invoice(p_id uuid, p_action text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
begin
  if not public.is_finance() then
    raise exception 'Only people who sign off invoices can do this' using errcode = '42501';
  end if;
  select * into inv from public.invoices where id = p_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if inv.user_id = auth.uid() and p_action in ('approve', 'paid') then
    raise exception 'You can''t sign off or pay your own invoice' using errcode = '42501';
  end if;

  if p_action = 'approve' and inv.status = 'submitted' then
    update public.invoices set status = 'approved', approved_at = now(), approved_by = auth.uid() where id = p_id;
  elsif p_action = 'paid' and inv.status = 'approved' then
    update public.invoices set status = 'paid', paid_at = now() where id = p_id;
  elsif p_action = 'return' and inv.status in ('submitted', 'approved') then
    if coalesce(trim(p_reason), '') = '' then
      raise exception 'Please say what needs changing' using errcode = '22023';
    end if;
    update public.invoices set status = 'returned', returned_reason = trim(p_reason), approved_at = null, approved_by = null where id = p_id;
  else
    raise exception 'That can''t be done to an invoice that is %', inv.status using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.submit_invoice(date) from public, anon;
revoke execute on function public.withdraw_invoice(uuid) from public, anon;
revoke execute on function public.review_invoice(uuid, text, text) from public, anon;
grant  execute on function public.submit_invoice(date) to authenticated;
grant  execute on function public.withdraw_invoice(uuid) to authenticated;
grant  execute on function public.review_invoice(uuid, text, text) to authenticated;

-- Who invoices are addressed to (shown on every invoice).
insert into public.app_settings (key, value) values ('invoice_to', '"Societree"')
on conflict (key) do nothing;
