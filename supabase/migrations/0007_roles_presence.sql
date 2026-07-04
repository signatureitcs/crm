-- Project Hub — QA + Super Admin roles, presence, profile fields, read-all.
-- Run after 0006_comments.sql.

-- Extend roles ---------------------------------------------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('manager','developer','designer','seo','gmb','qa','super_admin'));

-- Profile fields -------------------------------------------------------------
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists presence text
  not null default 'offline' check (presence in ('online','offline'));

-- QA review state on projects -----------------------------------------------
alter table projects add column if not exists qa_status text
  default 'pending' check (qa_status in ('pending','approved','rejected'));
alter table projects add column if not exists qa_reviewer_id uuid references profiles(id);
alter table projects add column if not exists qa_reviewed_at timestamptz;
alter table projects add column if not exists qa_note text;

-- Helpers --------------------------------------------------------------------
create or replace function public.is_qa()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'qa');
$$;

create or replace function public.is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin');
$$;

-- Managers, QA, and super admins can read everything.
create or replace function public.can_read_all()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('manager','qa','super_admin')
  );
$$;

-- Rewrite read policies to include the read-all roles -----------------------
drop policy if exists "projects_read" on projects;
create policy "projects_read" on projects for select to authenticated
  using (public.can_read_all() or public.owns_project(id));

drop policy if exists "phases_read" on phases;
create policy "phases_read" on phases for select to authenticated
  using (public.can_read_all() or public.owns_project(project_id));

drop policy if exists "tasks_read" on tasks;
create policy "tasks_read" on tasks for select to authenticated
  using (public.can_read_all() or public.owns_project(project_id) or assigned_to = auth.uid());

drop policy if exists "completions_read" on checklist_completions;
create policy "completions_read" on checklist_completions for select to authenticated
  using (public.can_read_all() or public.owns_project(project_id));

drop policy if exists "handoffs_read" on handoffs;
create policy "handoffs_read" on handoffs for select to authenticated
  using (public.can_read_all() or public.owns_project(project_id));

drop policy if exists "assets_read" on assets;
create policy "assets_read" on assets for select to authenticated
  using (public.can_read_all() or public.owns_project(project_id));

drop policy if exists "sitelinks_read" on sitelinks_rows;
create policy "sitelinks_read" on sitelinks_rows for select to authenticated
  using (public.can_read_all() or public.owns_project(project_id));

drop policy if exists "seo_logs_read" on seo_daily_logs;
create policy "seo_logs_read" on seo_daily_logs for select to authenticated
  using (public.can_read_all() or public.owns_project(project_id));

drop policy if exists "gmb_read" on gmb_tasks;
create policy "gmb_read" on gmb_tasks for select to authenticated
  using (public.can_read_all() or public.owns_project(project_id));

drop policy if exists "comments_select" on comments;
create policy "comments_select" on comments for select to authenticated
  using (public.can_read_all() or public.owns_project(project_id));

drop policy if exists "pm_select" on project_members;
create policy "pm_select" on project_members for select to authenticated
  using (public.can_read_all() or profile_id = auth.uid() or public.owns_project(project_id));

-- QA write access: notes anywhere, fix tasks, and project review -------------
drop policy if exists "tasks_insert" on tasks;
create policy "tasks_insert" on tasks for insert to authenticated
  with check (public.is_manager() or public.is_qa() or public.owns_project(project_id) or created_by = auth.uid());

drop policy if exists "comments_insert" on comments;
create policy "comments_insert" on comments for insert to authenticated
  with check (public.is_manager() or public.is_qa() or public.owns_project(project_id));

drop policy if exists "projects_qa_update" on projects;
create policy "projects_qa_update" on projects for update to authenticated
  using (public.is_qa()) with check (public.is_qa());

-- Avatars storage bucket -----------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
