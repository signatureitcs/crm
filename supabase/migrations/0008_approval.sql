-- Signature CRM — registration approval gate.
-- Run after 0007_roles_presence.sql.

alter table profiles add column if not exists approval_status text
  not null default 'pending'
  check (approval_status in ('pending','approved','rejected'));

-- Existing accounts keep access.
update profiles set approval_status = 'approved' where approval_status <> 'approved';

-- Force the approval state at insert time so a self-registering user can't
-- set themselves approved via the API.
--   • service-role / manager-created inserts (auth.uid() is null) -> approved
--   • the very first account ever            -> approved (bootstrap admin)
--   • any other self sign-up                 -> pending
create or replace function public.enforce_profile_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    new.approval_status := 'approved';
  elsif (select count(*) from public.profiles) = 0 then
    new.approval_status := 'approved';
  else
    new.approval_status := 'pending';
  end if;
  return new;
end $$;

drop trigger if exists trg_profile_approval on profiles;
create trigger trg_profile_approval
  before insert on profiles
  for each row execute function public.enforce_profile_approval();
