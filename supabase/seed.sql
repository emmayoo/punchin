-- Optional seed for local/dev usage
-- Run after schema.sql

insert into public.employees (phone, name, color)
values
  ('01050436015', '유연주', '#ef4444')
on conflict (phone) do nothing;

insert into public.shifts (employee_phone, employee_name, start_at, end_at)
select
  '01050436015',
  '유연주',
  date_trunc('day', now()) + interval '9 hours',
  date_trunc('day', now()) + interval '15 hours'
where not exists (
  select 1
  from public.shifts
  where employee_phone = '01050436015'
    and start_at >= date_trunc('day', now())
    and start_at < date_trunc('day', now()) + interval '1 day'
);
