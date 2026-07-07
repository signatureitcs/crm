-- Project Hub — let the whole team create projects and tasks (not just managers).
-- Run after 0008_approval.sql.

-- owns_project() now also treats explicit project members as owners, so any
-- member (not only the developer/designer/seo lead) can write to the project.
create or replace function public.owns_project(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = pid and (
      pr.developer_id = auth.uid()
      or pr.designer_id = auth.uid()
      or pr.seo_id = auth.uid()
    )
  ) or exists (
    select 1 from public.project_members pm
    where pm.project_id = pid and pm.profile_id = auth.uid()
  );
$$;

-- Projects: any approved user (except the read-only super admin) can create.
-- Managers or project owners can update; only managers can delete.
drop policy if exists "projects_write" on projects;
drop policy if exists "projects_insert" on projects;
create policy "projects_insert" on projects for insert to authenticated
  with check (not public.is_super_admin());
drop policy if exists "projects_update" on projects;
create policy "projects_update" on projects for update to authenticated
  using (public.is_manager() or public.owns_project(id))
  with check (public.is_manager() or public.owns_project(id));
drop policy if exists "projects_delete" on projects;
create policy "projects_delete" on projects for delete to authenticated
  using (public.is_manager());

-- Phases created as part of project creation.
drop policy if exists "phases_insert" on phases;
create policy "phases_insert" on phases for insert to authenticated
  with check (not public.is_super_admin());

-- Seeding project members at creation / inviting teammates.
drop policy if exists "pm_insert" on project_members;
create policy "pm_insert" on project_members for insert to authenticated
  with check (not public.is_super_admin());

-- GMB task rows created as part of GMB project creation.
drop policy if exists "gmb_insert" on gmb_tasks;
create policy "gmb_insert" on gmb_tasks for insert to authenticated
  with check (not public.is_super_admin());
