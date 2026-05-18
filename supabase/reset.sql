-- 전체 초기화
-- 1. DB 리셋 전/후에 pnpm storage:empty 실행
-- 2. SQL Editor: reset.sql → schema.sql → storage.sql 순으로 실행

do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('drop table if exists public.%I cascade', t.tablename);
  end loop;
end $$;

drop function if exists public.branch_memberships_owner_guard() cascade;
drop function if exists public.current_user_phone() cascade;
