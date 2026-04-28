-- Minimal schema for Punchin v1 (no multi-tenant extensions yet)

create extension if not exists "pgcrypto";

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.employees
add column if not exists color text not null default '#22c55e';

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  profile_image_url text null,
  name text not null,
  business_number text not null default '',
  address text null,
  store_phone text null,
  created_by_phone text not null references public.employees(phone) on update cascade,
  created_at timestamptz not null default now()
);

alter table public.branches
add column if not exists profile_image_url text null;

alter table public.branches
add column if not exists business_number text not null default '';

alter table public.branches
add column if not exists address text null;

alter table public.branches
add column if not exists store_phone text null;

create index if not exists branches_created_by_phone_idx
  on public.branches(created_by_phone);
create index if not exists branches_name_idx on public.branches(name);

create table if not exists public.branch_memberships (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  employee_phone text not null references public.employees(phone) on update cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (branch_id, employee_phone)
);

create index if not exists branch_memberships_employee_phone_idx
  on public.branch_memberships(employee_phone);

alter table public.employees
add column if not exists current_branch_id uuid references public.branches(id) on delete set null;

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_phone text not null references public.employees(phone) on update cascade,
  employee_name text not null,
  branch_id uuid null references public.branches(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint shifts_time_check check (end_at > start_at)
);

create index if not exists shifts_start_at_idx on public.shifts(start_at);
create index if not exists shifts_employee_phone_idx on public.shifts(employee_phone);
create index if not exists shifts_branch_id_idx on public.shifts(branch_id);

create table if not exists public.punch_records (
  id uuid primary key default gen_random_uuid(),
  employee_phone text not null references public.employees(phone) on update cascade,
  employee_name text not null,
  branch_id uuid null references public.branches(id) on delete set null,
  checked_in_at timestamptz not null,
  checked_out_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists punch_records_checked_in_at_idx on public.punch_records(checked_in_at);
create index if not exists punch_records_employee_phone_idx on public.punch_records(employee_phone);
create index if not exists punch_records_branch_id_idx on public.punch_records(branch_id);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid null references public.branches(id) on delete set null,
  date date not null,
  title text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_date_idx on public.calendar_events(date);
create index if not exists calendar_events_branch_id_idx on public.calendar_events(branch_id);

create or replace function public.current_user_phone()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'phone', '');
$$;

-- RLS (step 5: minimal, keep app behavior)
alter table public.employees enable row level security;
alter table public.branches enable row level security;
alter table public.branch_memberships enable row level security;
alter table public.shifts enable row level security;
alter table public.punch_records enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists employees_authenticated_all on public.employees;
create policy employees_authenticated_all
on public.employees
for all
to authenticated, anon
using (true)
with check (true);

drop policy if exists shifts_authenticated_all on public.shifts;
create policy shifts_authenticated_all
on public.shifts
for all
to authenticated
using (true)
with check (true);

drop policy if exists branches_authenticated_all on public.branches;
create policy branches_authenticated_all
on public.branches
for all
to authenticated, anon
using (true)
with check (true);

drop policy if exists branch_memberships_authenticated_all on public.branch_memberships;
create policy branch_memberships_authenticated_all
on public.branch_memberships
for all
to authenticated, anon
using (true)
with check (true);

drop policy if exists punches_authenticated_all on public.punch_records;
drop policy if exists punches_authenticated_select_all on public.punch_records;
create policy punches_authenticated_select_all
on public.punch_records
for select
to authenticated
using (true);

drop policy if exists punches_authenticated_insert_own on public.punch_records;
create policy punches_authenticated_insert_own
on public.punch_records
for insert
to authenticated, anon
with check (
  public.current_user_phone() = ''
  or employee_phone = public.current_user_phone()
);

drop policy if exists punches_authenticated_update_own on public.punch_records;
create policy punches_authenticated_update_own
on public.punch_records
for update
to authenticated, anon
using (
  public.current_user_phone() = ''
  or employee_phone = public.current_user_phone()
)
with check (
  public.current_user_phone() = ''
  or employee_phone = public.current_user_phone()
);

drop policy if exists calendar_events_authenticated_all on public.calendar_events;
create policy calendar_events_authenticated_all
on public.calendar_events
for all
to authenticated
using (true)
with check (true);
