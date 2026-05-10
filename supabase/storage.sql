-- Supabase Storage: 단일 공개 버킷 `media` + JWT(user_metadata.phone) 기준 업로드 정책
-- 적용: schema.sql 반영 후 대시보드 SQL에서 1회 실행 권장.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- JWT → 직원 id (auth.jwt user_metadata.phone = employees.phone)
-- ---------------------------------------------------------------------------

create or replace function public.storage_actor_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.employees e
  where e.phone = nullif(trim(coalesce(
    auth.jwt() -> 'user_metadata' ->> 'phone',
    auth.jwt() -> 'app_metadata' ->> 'phone',
    ''
  )), '')
    and e.deleted_at is null
  limit 1;
$$;

create or replace function public.storage_actor_can_manage_branch_profile(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.branches b
    where b.id = p_branch_id
      and b.deleted_at is null
      and (
        b.created_by_employee_id = public.storage_actor_employee_id()
        or exists (
          select 1
          from public.branch_memberships bm
          where bm.branch_id = p_branch_id
            and bm.employee_id = public.storage_actor_employee_id()
            and bm.role in ('owner', 'manager')
            and bm.ended_at is null
            and bm.deleted_at is null
        )
      )
  );
$$;

create or replace function public.storage_actor_can_manage_notice_media(p_notice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.notices n
    where n.id = p_notice_id
      and n.deleted_at is null
      and (
        n.author_employee_id = public.storage_actor_employee_id()
        or public.storage_actor_can_manage_branch_profile(n.branch_id)
      )
  );
$$;

-- 경로: avatars/{employee_uuid}/{file}
--      branches/{branch_uuid}/profile/{file}
--      notices/{notice_uuid}/{file}

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
on storage.objects for select
using (bucket_id = 'media');

drop policy if exists "media_avatar_insert" on storage.objects;
create policy "media_avatar_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'avatars'
  and split_part(name, '/', 2) = public.storage_actor_employee_id()::text
  and cardinality(regexp_split_to_array(trim(name), '/')) = 3
);

drop policy if exists "media_avatar_update" on storage.objects;
create policy "media_avatar_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'avatars'
  and split_part(name, '/', 2) = public.storage_actor_employee_id()::text
)
with check (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'avatars'
  and split_part(name, '/', 2) = public.storage_actor_employee_id()::text
);

drop policy if exists "media_avatar_delete" on storage.objects;
create policy "media_avatar_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'avatars'
  and split_part(name, '/', 2) = public.storage_actor_employee_id()::text
);

drop policy if exists "media_branch_profile_insert" on storage.objects;
create policy "media_branch_profile_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'branches'
  and split_part(name, '/', 3) = 'profile'
  and public.storage_actor_can_manage_branch_profile(split_part(name, '/', 2)::uuid)
  and cardinality(regexp_split_to_array(trim(name), '/')) = 4
);

drop policy if exists "media_branch_profile_update" on storage.objects;
create policy "media_branch_profile_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'branches'
  and split_part(name, '/', 3) = 'profile'
  and public.storage_actor_can_manage_branch_profile(split_part(name, '/', 2)::uuid)
)
with check (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'branches'
  and split_part(name, '/', 3) = 'profile'
  and public.storage_actor_can_manage_branch_profile(split_part(name, '/', 2)::uuid)
);

drop policy if exists "media_branch_profile_delete" on storage.objects;
create policy "media_branch_profile_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'branches'
  and split_part(name, '/', 3) = 'profile'
  and public.storage_actor_can_manage_branch_profile(split_part(name, '/', 2)::uuid)
);

drop policy if exists "media_notice_insert" on storage.objects;
create policy "media_notice_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'notices'
  and public.storage_actor_can_manage_notice_media(split_part(name, '/', 2)::uuid)
  and cardinality(regexp_split_to_array(trim(name), '/')) = 3
);

drop policy if exists "media_notice_update" on storage.objects;
create policy "media_notice_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'notices'
  and public.storage_actor_can_manage_notice_media(split_part(name, '/', 2)::uuid)
)
with check (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'notices'
  and public.storage_actor_can_manage_notice_media(split_part(name, '/', 2)::uuid)
);

drop policy if exists "media_notice_delete" on storage.objects;
create policy "media_notice_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'media'
  and split_part(name, '/', 1) = 'notices'
  and public.storage_actor_can_manage_notice_media(split_part(name, '/', 2)::uuid)
);

-- 정책 표현식에서 public 함수 호출 시 JWT 역할이 실행할 수 있어야 함(Skip하면 RLS 위반으로 403).
grant execute on function public.storage_actor_employee_id() to authenticated;
grant execute on function public.storage_actor_can_manage_branch_profile(uuid) to authenticated;
grant execute on function public.storage_actor_can_manage_notice_media(uuid) to authenticated;
