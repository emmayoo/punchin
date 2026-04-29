-- 전체 초기화: 실행 후 schema.sql 을 다시 적용하세요.

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
