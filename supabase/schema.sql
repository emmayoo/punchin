-- Punchin schema (roles: owner / manager / staff, soft deletes, audit log, employment periods)
-- 재입사: 동일 (branch_id, employee_id)에 ended_at IS NOT NULL인 과거 행은 두고,
--         ended_at IS NULL인 새 branch_memberships 행을 추가한다 (새 id).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 앱·계정
-- ---------------------------------------------------------------------------

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text not null,
  -- Supabase Storage 공개 URL (`media` 버킷 `avatars/{직원id}/…`).
  avatar_url text null,
  birth_date date null,
  current_branch_id uuid null,
  deleted_at timestamptz null,
  -- 본인이 표시 이름을 확정한 시각. NULL이면 매장/앱이 넣은 임시 이름만 있는 상태(확인 UI 대상). 형식은 고정하지 않음.
  display_name_confirmed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_phone_format check (phone <> ''),
  -- 전역 UNIQUE → PostgREST `upsert(onConflict: phone)` / `ON CONFLICT (phone)` 와 호환.
  -- 소프트 삭제 행도 같은 phone 으로 한 줄만 존재; 재가입은 upsert 로 deleted_at 을 null 로 되살림.
  constraint employees_phone_unique unique (phone)
);

create index employees_deleted_at_idx
  on public.employees (deleted_at)
  where deleted_at is null;


-- ---------------------------------------------------------------------------
-- 지점 (soft delete)
-- ---------------------------------------------------------------------------

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  profile_image_url text null,
  name text not null,
  business_number text not null default '',
  address text null,
  store_phone text null,
  created_by_employee_id uuid not null references public.employees (id) on delete restrict,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index branches_active_idx
  on public.branches (name)
  where deleted_at is null;

create index branches_deleted_at_idx
  on public.branches (deleted_at);

alter table public.employees
  add constraint employees_current_branch_fk
  foreign key (current_branch_id) references public.branches (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 지점 멤버십 (역할·재직 구간). ended_at null = 현재 재직
-- ---------------------------------------------------------------------------

create table public.branch_memberships (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  employee_id uuid not null references public.employees (id) on delete restrict,
  nickname text null,
  color text not null default '#22c55e',
  role text not null check (role in ('owner', 'manager', 'staff')),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint branch_memberships_time_check check (ended_at is null or ended_at >= started_at)
);

comment on table public.branch_memberships is
  '재입사: 가능하면 최근 ended 행을 재활성화(ended_at=null, started_at 갱신)해 중복 누적을 줄인다.';

create unique index branch_memberships_one_active_per_branch_employee
  on public.branch_memberships (branch_id, employee_id)
  where ended_at is null and deleted_at is null;

create index branch_memberships_branch_active_idx
  on public.branch_memberships (branch_id)
  where ended_at is null and deleted_at is null;

create index branch_memberships_employee_active_idx
  on public.branch_memberships (employee_id)
  where ended_at is null and deleted_at is null;

create index branch_memberships_branch_all_idx
  on public.branch_memberships (branch_id, ended_at nulls first, deleted_at nulls first);

-- ---------------------------------------------------------------------------
-- 스케줄·출퇴근·캘린더 (과거 데이터 보존용 스냅샷 이름 포함)
-- ---------------------------------------------------------------------------

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  employee_name text not null,
  branch_id uuid null references public.branches (id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint shifts_time_check check (end_at > start_at)
);

create index shifts_branch_start_active_idx
  on public.shifts (branch_id, start_at)
  where deleted_at is null;

create index shifts_employee_start_active_idx
  on public.shifts (employee_id, start_at)
  where deleted_at is null;

create index shifts_start_at_brin_idx
  on public.shifts using brin (start_at);

create table public.punch_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  employee_name text not null,
  branch_id uuid null references public.branches (id) on delete set null,
  checked_in_at timestamptz not null,
  checked_out_at timestamptz null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index punch_records_branch_checked_in_active_idx
  on public.punch_records (branch_id, checked_in_at desc)
  where deleted_at is null;

create index punch_records_employee_checked_in_active_idx
  on public.punch_records (employee_id, checked_in_at desc)
  where deleted_at is null;

create index punch_records_checked_in_brin_idx
  on public.punch_records using brin (checked_in_at);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid null references public.branches (id) on delete set null,
  date date not null,
  title text not null,
  color text not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index calendar_events_branch_date_active_idx
  on public.calendar_events (branch_id, date)
  where deleted_at is null;

create index calendar_events_date_active_idx
  on public.calendar_events (date)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 공지
-- ---------------------------------------------------------------------------

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  author_employee_id uuid not null references public.employees (id) on delete restrict,
  author_name text not null default '',
  title text not null,
  body text not null default '',
  is_pinned boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notices_branch_created_active_idx
  on public.notices (branch_id, created_at desc)
  where deleted_at is null;

create index notices_branch_pinned_created_active_idx
  on public.notices (branch_id, is_pinned desc, created_at desc)
  where deleted_at is null;

create table public.notice_attachments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices (id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  deleted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index notice_attachments_notice_sort_active_idx
  on public.notice_attachments (notice_id, sort_order asc, created_at asc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 감사 로그 (최소 필드: 한 줄 append)
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  branch_id uuid null references public.branches (id) on delete set null,
  actor_employee_id uuid null references public.employees (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  payload jsonb null,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  '예: notice.update, membership.role_change, branch.soft_delete. payload에 변경 요약 JSON.';

create index audit_logs_branch_created_idx
  on public.audit_logs (branch_id, created_at desc);

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

create index audit_logs_created_brin_idx
  on public.audit_logs using brin (created_at);

-- ---------------------------------------------------------------------------
-- 마지막 owner 보호 (역할 변경·퇴사·멤버십 삭제 시)
-- ---------------------------------------------------------------------------

create or replace function public.branch_memberships_owner_guard()
returns trigger
language plpgsql
as $$
declare
  other_owners int;
  risky boolean;
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner'
       and old.ended_at is null
       and old.deleted_at is null then
      select count(*) into other_owners
      from public.branch_memberships bm
      where bm.branch_id = old.branch_id
        and bm.role = 'owner'
        and bm.ended_at is null
        and bm.deleted_at is null
        and bm.id <> old.id;
      if other_owners = 0 then
        raise exception 'branch_must_have_owner'
          using hint = '지점에 최소 한 명의 owner가 필요합니다.';
      end if;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    risky := old.role = 'owner'
      and old.ended_at is null
      and old.deleted_at is null
      and (
        new.role is distinct from old.role
        or (new.ended_at is not null and old.ended_at is null)
        or (new.deleted_at is not null and old.deleted_at is null)
      );
    if risky then
      select count(*) into other_owners
      from public.branch_memberships bm
      where bm.branch_id = old.branch_id
        and bm.role = 'owner'
        and bm.ended_at is null
        and bm.deleted_at is null
        and bm.id <> old.id;
      if other_owners = 0 then
        raise exception 'branch_must_have_owner'
          using hint = '지점에 최소 한 명의 owner가 필요합니다.';
      end if;
    end if;
    return new;
  end if;

  raise exception 'branch_memberships_owner_guard: unexpected tg_op %', tg_op;
end;
$$;

drop trigger if exists branch_memberships_owner_guard_del on public.branch_memberships;
create trigger branch_memberships_owner_guard_del
  before delete on public.branch_memberships
  for each row execute procedure public.branch_memberships_owner_guard();

drop trigger if exists branch_memberships_owner_guard_upd on public.branch_memberships;
create trigger branch_memberships_owner_guard_upd
  before update on public.branch_memberships
  for each row execute procedure public.branch_memberships_owner_guard();

-- ---------------------------------------------------------------------------
-- JWT에서 전화번호 (기존 정책과 호환용)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_phone()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'phone', '');
$$;

-- ---------------------------------------------------------------------------
-- RLS (개발용 넓게 유지 — 배포 전 정책 좁히기)
-- ---------------------------------------------------------------------------

alter table public.employees enable row level security;
alter table public.branches enable row level security;
alter table public.branch_memberships enable row level security;
alter table public.shifts enable row level security;
alter table public.punch_records enable row level security;
alter table public.calendar_events enable row level security;
alter table public.notices enable row level security;
alter table public.notice_attachments enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists employees_authenticated_all on public.employees;
create policy employees_authenticated_all
on public.employees for all
to authenticated, anon using (true) with check (true);

drop policy if exists branches_authenticated_all on public.branches;
create policy branches_authenticated_all
on public.branches for all
to authenticated, anon using (true) with check (true);

drop policy if exists branch_memberships_authenticated_all on public.branch_memberships;
create policy branch_memberships_authenticated_all
on public.branch_memberships for all
to authenticated, anon using (true) with check (true);

drop policy if exists shifts_authenticated_all on public.shifts;
create policy shifts_authenticated_all
on public.shifts for all
to authenticated using (true) with check (true);

drop policy if exists punch_records_select_all on public.punch_records;
create policy punch_records_select_all
on public.punch_records for select
to authenticated using (true);

drop policy if exists punch_records_insert_policy on public.punch_records;
create policy punch_records_insert_policy
on public.punch_records for insert
to authenticated, anon
with check (
  public.current_user_phone() = ''
  or exists (
    select 1
    from public.employees actor
    where actor.phone = public.current_user_phone()
      and actor.deleted_at is null
      and (
        actor.id = employee_id
        or exists (
          select 1
          from public.branch_memberships bm
          where bm.branch_id = punch_records.branch_id
            and bm.employee_id = actor.id
            and bm.role in ('owner', 'manager')
            and bm.ended_at is null
            and bm.deleted_at is null
        )
        or exists (
          select 1
          from public.branches b
          where b.id = punch_records.branch_id
            and b.created_by_employee_id = actor.id
            and b.deleted_at is null
        )
      )
  )
);

drop policy if exists punch_records_update_policy on public.punch_records;
create policy punch_records_update_policy
on public.punch_records for update
to authenticated, anon
using (
  public.current_user_phone() = ''
  or exists (
    select 1
    from public.employees actor
    where actor.phone = public.current_user_phone()
      and actor.deleted_at is null
      and (
        actor.id = employee_id
        or exists (
          select 1
          from public.branch_memberships bm
          where bm.branch_id = punch_records.branch_id
            and bm.employee_id = actor.id
            and bm.role in ('owner', 'manager')
            and bm.ended_at is null
            and bm.deleted_at is null
        )
        or exists (
          select 1
          from public.branches b
          where b.id = punch_records.branch_id
            and b.created_by_employee_id = actor.id
            and b.deleted_at is null
        )
      )
  )
)
with check (
  public.current_user_phone() = ''
  or exists (
    select 1
    from public.employees actor
    where actor.phone = public.current_user_phone()
      and actor.deleted_at is null
      and (
        actor.id = employee_id
        or exists (
          select 1
          from public.branch_memberships bm
          where bm.branch_id = punch_records.branch_id
            and bm.employee_id = actor.id
            and bm.role in ('owner', 'manager')
            and bm.ended_at is null
            and bm.deleted_at is null
        )
        or exists (
          select 1
          from public.branches b
          where b.id = punch_records.branch_id
            and b.created_by_employee_id = actor.id
            and b.deleted_at is null
        )
      )
  )
);

drop policy if exists calendar_events_authenticated_all on public.calendar_events;
create policy calendar_events_authenticated_all
on public.calendar_events for all
to authenticated using (true) with check (true);

drop policy if exists notices_authenticated_all on public.notices;
drop policy if exists notices_select_policy on public.notices;
drop policy if exists notices_insert_policy on public.notices;
drop policy if exists notices_update_policy on public.notices;
drop policy if exists notices_delete_policy on public.notices;

create policy notices_select_policy
on public.notices for select
to authenticated
using (deleted_at is null);

create policy notices_insert_policy
on public.notices for insert
to authenticated
with check (
  exists (
    select 1
    from public.employees actor
    where actor.phone = public.current_user_phone()
      and actor.deleted_at is null
      and actor.id = author_employee_id
      and (
        exists (
          select 1
          from public.branch_memberships bm
          where bm.branch_id = notices.branch_id
            and bm.employee_id = actor.id
            and bm.ended_at is null
            and bm.deleted_at is null
        )
        or exists (
          select 1
          from public.branches b
          where b.id = notices.branch_id
            and b.created_by_employee_id = actor.id
            and b.deleted_at is null
        )
      )
  )
);

create policy notices_update_policy
on public.notices for update
to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.employees actor
    left join public.branch_memberships author_m
      on author_m.branch_id = notices.branch_id
     and author_m.employee_id = notices.author_employee_id
     and author_m.ended_at is null
     and author_m.deleted_at is null
    where actor.phone = public.current_user_phone()
      and actor.deleted_at is null
      and (
        actor.id = notices.author_employee_id
        or (
          (
            exists (
              select 1 from public.branch_memberships bm
              where bm.branch_id = notices.branch_id
                and bm.employee_id = actor.id
                and bm.role in ('owner', 'manager')
                and bm.ended_at is null
                and bm.deleted_at is null
            )
            or exists (
              select 1 from public.branches b
              where b.id = notices.branch_id
                and b.created_by_employee_id = actor.id
                and b.deleted_at is null
            )
          )
          and (
            coalesce(author_m.role, 'staff') = 'staff'
            or (
              coalesce(author_m.role, 'staff') = 'manager'
              and (
                exists (
                  select 1 from public.branch_memberships bm2
                  where bm2.branch_id = notices.branch_id
                    and bm2.employee_id = actor.id
                    and bm2.role = 'owner'
                    and bm2.ended_at is null
                    and bm2.deleted_at is null
                )
                or exists (
                  select 1 from public.branches b2
                  where b2.id = notices.branch_id
                    and b2.created_by_employee_id = actor.id
                    and b2.deleted_at is null
                )
              )
            )
          )
        )
      )
  )
)
with check (true);

create policy notices_delete_policy
on public.notices for delete
to authenticated
using (
  exists (
    select 1
    from public.employees actor
    left join public.branch_memberships author_m
      on author_m.branch_id = notices.branch_id
     and author_m.employee_id = notices.author_employee_id
     and author_m.ended_at is null
     and author_m.deleted_at is null
    where actor.phone = public.current_user_phone()
      and actor.deleted_at is null
      and (
        actor.id = notices.author_employee_id
        or (
          (
            exists (
              select 1 from public.branch_memberships bm
              where bm.branch_id = notices.branch_id
                and bm.employee_id = actor.id
                and bm.role in ('owner', 'manager')
                and bm.ended_at is null
                and bm.deleted_at is null
            )
            or exists (
              select 1 from public.branches b
              where b.id = notices.branch_id
                and b.created_by_employee_id = actor.id
                and b.deleted_at is null
            )
          )
          and (
            coalesce(author_m.role, 'staff') = 'staff'
            or (
              coalesce(author_m.role, 'staff') = 'manager'
              and (
                exists (
                  select 1 from public.branch_memberships bm2
                  where bm2.branch_id = notices.branch_id
                    and bm2.employee_id = actor.id
                    and bm2.role = 'owner'
                    and bm2.ended_at is null
                    and bm2.deleted_at is null
                )
                or exists (
                  select 1 from public.branches b2
                  where b2.id = notices.branch_id
                    and b2.created_by_employee_id = actor.id
                    and b2.deleted_at is null
                )
              )
            )
          )
        )
      )
  )
);

drop policy if exists notice_attachments_authenticated_all on public.notice_attachments;
create policy notice_attachments_authenticated_all
on public.notice_attachments for all
to authenticated
using (true) with check (true);

drop policy if exists audit_logs_authenticated_all on public.audit_logs;
create policy audit_logs_authenticated_all
on public.audit_logs for all
to authenticated using (true) with check (true);
