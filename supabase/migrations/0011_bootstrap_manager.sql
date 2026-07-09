-- Signature CRM — bootstrap the first account as the manager.
-- Manager/super_admin are no longer self-selectable at sign-up, so the very
-- first account must become the manager automatically (approved), otherwise a
-- fresh install would have no one who can approve users or assign roles.
-- Run after 0010_multi_role.sql. Safe to re-run; existing installs with a
-- manager are unaffected (this only fires when the profiles table is empty).

create or replace function public.enforce_profile_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.profiles) = 0 then
    -- First account ever -> approved bootstrap manager.
    new.approval_status := 'approved';
    new.roles := array['manager'];
    new.role := 'manager';
  elsif auth.uid() is null then
    -- Service-role / manager-created inserts.
    new.approval_status := 'approved';
  else
    -- Any other self sign-up waits for approval.
    new.approval_status := 'pending';
  end if;
  return new;
end $$;
