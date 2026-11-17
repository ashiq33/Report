-- Warp Knitting Daily Production Report
-- Run in Supabase SQL Editor after creating a project.
-- Create Auth users first, then set profiles.role to admin/boss.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'User',
  role text not null default 'boss' check (role in ('admin', 'boss')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  reporting_date date not null unique,
  production_date date not null,
  reporting_month date not null,
  monthly_order_mtr numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
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

-- Automatically create a profile for newly-created Auth users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'boss'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.daily_reports enable row level security;
alter table public.production_data enable row level security;
alter table public.stock_data enable row level security;
alter table public.resource_data enable row level security;
alter table public.import_batches enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can read their own profile; admins can read all profiles.
create policy "Read own profile or admin reads all"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy "Admin updates profiles"
on public.profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Main reports: admin full access; boss reads submitted reports only.
create policy "Admin full access to reports"
on public.daily_reports for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Boss reads submitted reports"
on public.daily_reports for select to authenticated
using (status = 'submitted');

-- Child data visibility follows parent report visibility.
create policy "Admin full access production"
on public.production_data for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Authenticated users read visible production"
on public.production_data for select to authenticated
using (exists (
  select 1 from public.daily_reports r
  where r.id = report_id and (r.status = 'submitted' or public.is_admin())
));

create policy "Admin full access stock"
on public.stock_data for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Authenticated users read visible stock"
on public.stock_data for select to authenticated
using (exists (
  select 1 from public.daily_reports r
  where r.id = report_id and (r.status = 'submitted' or public.is_admin())
));

create policy "Admin full access resources"
on public.resource_data for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Authenticated users read visible resources"
on public.resource_data for select to authenticated
using (exists (
  select 1 from public.daily_reports r
  where r.id = report_id and (r.status = 'submitted' or public.is_admin())
));

create policy "Admin manages import batches"
on public.import_batches for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admin reads audit logs"
on public.audit_logs for select to authenticated
using (public.is_admin());

create policy "Admin inserts audit logs"
on public.audit_logs for insert to authenticated
with check (public.is_admin());

-- After creating your first Auth user, promote that user:
-- update public.profiles set role = 'admin' where id = 'YOUR-AUTH-USER-UUID';
