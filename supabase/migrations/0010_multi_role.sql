-- Project Hub — multi-role users.
-- A user can hold several roles (developer + seo + gmb, etc). Manager and
-- super_admin remain exclusive. `roles` is the full set; `role` is kept in
-- sync as the primary role so existing single-role checks keep working.
-- Run after 0009_open_creation.sql.

alter table profiles add column if not exists roles text[] not null default '{}';

-- Backfill from the existing single role.
update profiles set roles = array[role] where cardinality(roles) = 0;

-- Keep `role` (primary) derived from `roles`: manager/super_admin win and are
-- exclusive; otherwise the first listed role is primary.
create or replace function public.sync_primary_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.roles is null or cardinality(new.roles) = 0 then
    new.roles := array[new.role];
  end if;
  if 'manager' = any(new.roles) then
    new.roles := array['manager'];
    new.role := 'manager';
  elsif 'super_admin' = any(new.roles) then
    new.roles := array['super_admin'];
    new.role := 'super_admin';
  else
    new.role := new.roles[1];
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_primary_role on profiles;
create trigger trg_sync_primary_role
  before insert or update on profiles
  for each row execute function public.sync_primary_role();
