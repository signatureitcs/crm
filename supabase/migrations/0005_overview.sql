-- Project Hub — ensure users can always read tasks assigned to them (for the
-- personal Overview), even on projects where they aren't otherwise a member.
-- Run after 0004_checklist_notes.sql.

drop policy if exists "tasks_read" on tasks;
create policy "tasks_read" on tasks
  for select to authenticated
  using (
    public.is_manager()
    or public.owns_project(project_id)
    or assigned_to = auth.uid()
  );
