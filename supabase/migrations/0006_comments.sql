-- Project Hub — project notes / comments with @mentions.
-- Run after 0005_overview.sql.

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,   -- null = project-level note
  author_id uuid references profiles(id),
  body text not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_comments_project on comments(project_id, created_at desc);
create index if not exists idx_comments_task on comments(task_id);

alter table comments enable row level security;

-- Readable/writable by managers and project members.
drop policy if exists "comments_select" on comments;
create policy "comments_select" on comments
  for select to authenticated
  using (public.is_manager() or public.owns_project(project_id));

drop policy if exists "comments_insert" on comments;
create policy "comments_insert" on comments
  for insert to authenticated
  with check (public.is_manager() or public.owns_project(project_id));

drop policy if exists "comments_delete" on comments;
create policy "comments_delete" on comments
  for delete to authenticated
  using (public.is_manager() or author_id = auth.uid());
