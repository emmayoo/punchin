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

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_phone text not null references public.employees(phone) on update cascade,
  employee_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint shifts_time_check check (end_at > start_at)
);

create index if not exists shifts_start_at_idx on public.shifts(start_at);
create index if not exists shifts_employee_phone_idx on public.shifts(employee_phone);

create table if not exists public.punch_records (
  id uuid primary key default gen_random_uuid(),
  employee_phone text not null references public.employees(phone) on update cascade,
  employee_name text not null,
  checked_in_at timestamptz not null,
  checked_out_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists punch_records_checked_in_at_idx on public.punch_records(checked_in_at);
create index if not exists punch_records_employee_phone_idx on public.punch_records(employee_phone);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_date_idx on public.calendar_events(date);

create or replace function public.current_user_phone()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'phone', '');
$$;

-- RLS (step 5: minimal, keep app behavior)
alter table public.employees enable row level security;
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
