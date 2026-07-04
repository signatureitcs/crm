-- Project Hub — multi-member project teams + hide-until-assigned visibility.
-- Run after 0002_notifications.sql.

-- Project metadata ----------------------------------------------------------
alter table projects add column if not exists description text;
alter table projects add column if not exists client_name text;
alter table projects add column if not exists client_contact text;

-- Project members (many people per project) ---------------------------------
create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  added_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (project_id, profile_id)
);

create index if not exists idx_project_members_project on project_members(project_id);
create index if not exists idx_project_members_profile on project_members(profile_id);

-- Redefine ownership to include membership (drives both read + write access).
create or replace function public.owns_project(pid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = pid and (
      pr.developer_id = auth.uid()
      or pr.designer_id = auth.uid()
      or pr.seo_id = auth.uid()
    )
  ) or exists (
    select 1 from public.project_members m
    where m.project_id = pid and m.profile_id = auth.uid()
  );
$$;

-- project_members RLS: managers manage; members see their teams.
alter table project_members enable row level security;

drop policy if exists "pm_select" on project_members;
create policy "pm_select" on project_members
  for select to authenticated
  using (
    public.is_manager()
    or profile_id = auth.uid()
    or public.owns_project(project_id)
  );

drop policy if exists "pm_write" on project_members;
create policy "pm_write" on project_members
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- =========================================================================
-- Tighten SELECT policies: hide projects (and their data) from non-members.
-- profiles / countries / checklist_templates stay world-readable (needed for
-- names, the sidebar country list, and checklist labels).
-- =========================================================================

drop policy if exists "projects_read" on projects;
create policy "projects_read" on projects
  for select to authenticated
  using (public.is_manager() or public.owns_project(id));

drop policy if exists "phases_read" on phases;
create policy "phases_read" on phases
  for select to authenticated
  using (public.is_manager() or public.owns_project(project_id));

drop policy if exists "tasks_read" on tasks;
create policy "tasks_read" on tasks
  for select to authenticated
  using (public.is_manager() or public.owns_project(project_id));

drop policy if exists "completions_read" on checklist_completions;
create policy "completions_read" on checklist_completions
  for select to authenticated
  using (public.is_manager() or public.owns_project(project_id));

drop policy if exists "handoffs_read" on handoffs;
create policy "handoffs_read" on handoffs
  for select to authenticated
  using (public.is_manager() or public.owns_project(project_id));

drop policy if exists "assets_read" on assets;
create policy "assets_read" on assets
  for select to authenticated
  using (public.is_manager() or public.owns_project(project_id));

drop policy if exists "sitelinks_read" on sitelinks_rows;
create policy "sitelinks_read" on sitelinks_rows
  for select to authenticated
  using (public.is_manager() or public.owns_project(project_id));

drop policy if exists "seo_logs_read" on seo_daily_logs;
create policy "seo_logs_read" on seo_daily_logs
  for select to authenticated
  using (public.is_manager() or public.owns_project(project_id));

drop policy if exists "gmb_read" on gmb_tasks;
create policy "gmb_read" on gmb_tasks
  for select to authenticated
  using (public.is_manager() or public.owns_project(project_id));
