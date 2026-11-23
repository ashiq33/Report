-- Warp Knitting Daily Production Report: role-aware Supabase schema
-- Safe to re-run. Run in Supabase SQL Editor as project owner.
-- Roles are stored in public.profiles.role: admin, boss, user.
-- New accounts are always created as "user"; promote trusted accounts manually.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'User',
  email text,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
create unique index if not exists idx_profiles_email on public.profiles(email) where email is not null;
alter table public.profiles alter column role set default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','boss','user'));

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  reporting_date date not null unique,
  production_date date not null,
  reporting_month date not null,
  monthly_order_mtr numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','submitted')),
  remarks text not null default '',
  created_by uuid references public.profiles(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_data (
  report_id uuid primary key references public.daily_reports(id) on delete cascade,
  monthly_production_mtr numeric(14,2) not null default 0,
  monthly_production_kg numeric(14,2) not null default 0,
  monthly_production_rolls integer not null default 0,
  sap_confirmation_mtr numeric(14,2) not null default 0,
  daily_production_mtr numeric(14,2) not null default 0,
  daily_production_kg numeric(14,2) not null default 0,
  daily_production_rolls integer not null default 0,
  daily_target_mtr numeric(14,2) not null default 0,
  columbia_mtr numeric(14,2) not null default 0,
  columbia_kg numeric(14,2) not null default 0,
  columbia_rolls integer not null default 0,
  columbia_target_mtr numeric(14,2) not null default 0,
  apm_yarn_kg numeric(14,2) not null default 0,
  sap_yarn_kg numeric(14,2) not null default 0
);

create table if not exists public.stock_data (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  category text not null,
  quantity_mtr numeric(14,2) not null default 0,
  quantity_kg numeric(14,2) not null default 0,
  quantity_rolls integer not null default 0,
  unique(report_id, category)
);

create table if not exists public.resource_data (
  report_id uuid primary key references public.daily_reports(id) on delete cascade,
  total_present integer not null default 0,
  total_required integer not null default 0,
  shifting_present integer not null default 0,
  shifting_required integer not null default 0,
  general_present integer not null default 0,
  general_required integer not null default 0,
  leave_count integer not null default 0,
  warping_machines integer not null default 0,
  knitting_machines integer not null default 0
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.daily_reports(id) on delete set null,
  file_name text not null,
  imported_by uuid references public.profiles(id),
  imported_at timestamptz not null default now(),
  import_status text not null default 'success'
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.daily_reports(id) on delete set null,
  user_id uuid references public.profiles(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_reports_reporting_date on public.daily_reports(reporting_date desc);
create index if not exists idx_daily_reports_status on public.daily_reports(status);
create index if not exists idx_stock_data_report on public.stock_data(report_id);
create index if not exists idx_daily_reports_created_by on public.daily_reports(created_by);

-- Role lookup runs as database owner so RLS can safely consult the profile table.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

-- Automatically create a least-privilege profile for each new Auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(split_part(coalesce(new.email,''), '@', 1), ''), 'User'),
    new.email,
    'user'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill Auth accounts that existed before this trigger/schema was installed.
insert into public.profiles (id, full_name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email,''), '@', 1), 'User'),
  u.email,
  'user'
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name;

alter table public.profiles enable row level security;
alter table public.daily_reports enable row level security;
alter table public.production_data enable row level security;
alter table public.stock_data enable row level security;
alter table public.resource_data enable row level security;
alter table public.import_batches enable row level security;
alter table public.audit_logs enable row level security;

-- Remove the policies from earlier app versions before installing the role-aware set.
drop policy if exists "Read own profile or admin reads all" on public.profiles;
drop policy if exists "Admin updates profiles" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;

drop policy if exists "Admin full access to reports" on public.daily_reports;
drop policy if exists "Boss reads submitted reports" on public.daily_reports;
drop policy if exists "daily_reports_admin_all" on public.daily_reports;
drop policy if exists "daily_reports_boss_submitted" on public.daily_reports;
drop policy if exists "daily_reports_user_own" on public.daily_reports;

drop policy if exists "Admin full access production" on public.production_data;
drop policy if exists "Authenticated users read visible production" on public.production_data;
drop policy if exists "production_admin_all" on public.production_data;
drop policy if exists "production_read_visible" on public.production_data;

drop policy if exists "Admin full access stock" on public.stock_data;
drop policy if exists "Authenticated users read visible stock" on public.stock_data;
drop policy if exists "stock_admin_all" on public.stock_data;
drop policy if exists "stock_read_visible" on public.stock_data;

drop policy if exists "Admin full access resources" on public.resource_data;
drop policy if exists "Authenticated users read visible resources" on public.resource_data;
drop policy if exists "resources_admin_all" on public.resource_data;
drop policy if exists "resources_read_visible" on public.resource_data;

drop policy if exists "Admin manages import batches" on public.import_batches;
drop policy if exists "import_batches_admin_all" on public.import_batches;
drop policy if exists "Admin reads audit logs" on public.audit_logs;
drop policy if exists "Admin inserts audit logs" on public.audit_logs;
drop policy if exists "audit_logs_admin_select" on public.audit_logs;
drop policy if exists "audit_logs_admin_insert" on public.audit_logs;

-- Profiles: every user can read their own role; admins can read/update all profiles.
create policy "profiles_select_self_or_admin"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles_admin_update"
on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Reports: admins manage all; bosses read submitted reports; users read only their own reports.
create policy "daily_reports_admin_all"
on public.daily_reports for all to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "daily_reports_boss_submitted"
on public.daily_reports for select to authenticated
using (public.current_app_role() = 'boss' and status = 'submitted');

create policy "daily_reports_user_own"
on public.daily_reports for select to authenticated
using (public.current_app_role() = 'user' and created_by = auth.uid());

-- Child rows inherit access from their parent report.
create policy "production_admin_all"
on public.production_data for all to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "production_read_visible"
on public.production_data for select to authenticated
using (exists (
  select 1 from public.daily_reports r
  where r.id = report_id
    and (
      (public.current_app_role() = 'admin')
      or (public.current_app_role() = 'boss' and r.status = 'submitted')
      or (public.current_app_role() = 'user' and r.created_by = auth.uid())
    )
));

create policy "stock_admin_all"
on public.stock_data for all to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "stock_read_visible"
on public.stock_data for select to authenticated
using (exists (
  select 1 from public.daily_reports r
  where r.id = report_id
    and (
      (public.current_app_role() = 'admin')
      or (public.current_app_role() = 'boss' and r.status = 'submitted')
      or (public.current_app_role() = 'user' and r.created_by = auth.uid())
    )
));

create policy "resources_admin_all"
on public.resource_data for all to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "resources_read_visible"
on public.resource_data for select to authenticated
using (exists (
  select 1 from public.daily_reports r
  where r.id = report_id
    and (
      (public.current_app_role() = 'admin')
      or (public.current_app_role() = 'boss' and r.status = 'submitted')
      or (public.current_app_role() = 'user' and r.created_by = auth.uid())
    )
));

create policy "import_batches_admin_all"
on public.import_batches for all to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "audit_logs_admin_select"
on public.audit_logs for select to authenticated
using (public.current_app_role() = 'admin');

create policy "audit_logs_admin_insert"
on public.audit_logs for insert to authenticated
with check (public.current_app_role() = 'admin');

-- Assign the three known application accounts by BOTH Auth UUID and email.
-- Matching both values prevents accidentally granting a role to a different account.
update public.profiles
set role = 'user'
where id = 'ce3dbe0e-3e02-4dd1-acf0-8eb274a46262'::uuid
  and lower(email) = lower('user@user.com');

update public.profiles
set role = 'admin'
where id = '298bbd7e-b23c-4a6e-b8a1-9847e934bab8'::uuid
  and lower(email) = lower('ashiqshahariar@gmail.com');

update public.profiles
set role = 'boss'
where id = '08a443fe-9cb9-462e-aae2-1705e1241117'::uuid
  and lower(email) = lower('ashiqshahariar003@gmail.com');

-- Fail clearly if any supplied UID/email pair does not match exactly one profile.
do $$
declare
  user_matches integer;
  admin_matches integer;
  boss_matches integer;
begin
  select count(*) into user_matches from public.profiles
    where id = 'ce3dbe0e-3e02-4dd1-acf0-8eb274a46262'::uuid
      and lower(email) = lower('user@user.com') and role = 'user';
  select count(*) into admin_matches from public.profiles
    where id = '298bbd7e-b23c-4a6e-b8a1-9847e934bab8'::uuid
      and lower(email) = lower('ashiqshahariar@gmail.com') and role = 'admin';
  select count(*) into boss_matches from public.profiles
    where id = '08a443fe-9cb9-462e-aae2-1705e1241117'::uuid
      and lower(email) = lower('ashiqshahariar003@gmail.com') and role = 'boss';

  if user_matches <> 1 then
    raise exception 'User profile mismatch: expected UID ce3dbe0e-3e02-4dd1-acf0-8eb274a46262 with user@user.com';
  end if;
  if admin_matches <> 1 then
    raise exception 'Admin profile mismatch: expected UID 298bbd7e-b23c-4a6e-b8a1-9847e934bab8 with ashiqshahariar@gmail.com';
  end if;
  if boss_matches <> 1 then
    raise exception 'Boss profile mismatch: expected UID 08a443fe-9cb9-462e-aae2-1705e1241117 with ashiqshahariar003@gmail.com';
  end if;
end;
$$;

-- Verify the final assignments in SQL Editor results.
select id, email, role
from public.profiles
where id in (
  'ce3dbe0e-3e02-4dd1-acf0-8eb274a46262'::uuid,
  '298bbd7e-b23c-4a6e-b8a1-9847e934bab8'::uuid,
  '08a443fe-9cb9-462e-aae2-1705e1241117'::uuid
)
order by case role when 'admin' then 1 when 'boss' then 2 else 3 end;
