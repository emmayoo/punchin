-- Add branch profile fields for /branch modal workflow.
-- Safe to run multiple times.

begin;

alter table public.branches
add column if not exists profile_image_url text null;

alter table public.branches
add column if not exists business_number text not null default '';

alter table public.branches
add column if not exists address text null;

alter table public.branches
add column if not exists store_phone text null;

commit;

-- Force PostgREST schema cache reload for immediate API visibility.
notify pgrst, 'reload schema';
