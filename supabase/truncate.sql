-- 데이터만 전체 초기화 (스키마/테이블 구조 유지)
begin;
truncate table
  public.branch_memberships,
  public.shifts,
  public.punch_records,
  public.calendar_events,
  public.branches,
  public.employees
restart identity cascade;
commit;