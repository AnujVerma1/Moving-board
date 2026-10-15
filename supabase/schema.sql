-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

-- 1. Boards (one row per canvas)
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'Untitled',
  elements    jsonb not null default '[]'::jsonb,
  app_state   jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists boards_user_id_idx on public.boards (user_id, updated_at desc);

alter table public.boards enable row level security;

drop policy if exists "own boards select" on public.boards;
drop policy if exists "own boards insert" on public.boards;
drop policy if exists "own boards update" on public.boards;
drop policy if exists "own boards delete" on public.boards;

create policy "own boards select" on public.boards for select using (auth.uid() = user_id);
create policy "own boards insert" on public.boards for insert with check (auth.uid() = user_id);
create policy "own boards update" on public.boards for update using (auth.uid() = user_id);
create policy "own boards delete" on public.boards for delete using (auth.uid() = user_id);

-- 2. Private storage bucket for pasted images / screenshots.
--    Files live at  <user_id>/<file_id>
insert into storage.buckets (id, name, public)
values ('board-files', 'board-files', false)
on conflict (id) do nothing;

drop policy if exists "own files select" on storage.objects;
drop policy if exists "own files insert" on storage.objects;
drop policy if exists "own files update" on storage.objects;
drop policy if exists "own files delete" on storage.objects;

create policy "own files select" on storage.objects for select
  using (bucket_id = 'board-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files insert" on storage.objects for insert
  with check (bucket_id = 'board-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files update" on storage.objects for update
  using (bucket_id = 'board-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete
  using (bucket_id = 'board-files' and (storage.foldername(name))[1] = auth.uid()::text);
