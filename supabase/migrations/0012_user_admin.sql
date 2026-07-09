-- Signature CRM — let managers delete or suspend user accounts.
-- Run after 0011_bootstrap_manager.sql.

-- 1) Add a "suspended" account state (blocks access like pending/rejected).
alter table profiles drop constraint if exists profiles_approval_status_check;
alter table profiles add constraint profiles_approval_status_check
  check (approval_status in ('pending','approved','rejected','suspended'));

-- 2) Make profile references null out on delete so a user with assigned work
--    can be removed cleanly (membership/notifications already cascade).
do $$
declare
  r record;
begin
  for r in
    select con.conname, cl.relname as tbl, att.attname as col
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_class rf on rf.oid = con.confrelid
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and rf.relname = 'profiles'
      and con.confdeltype = 'a'            -- only the NO ACTION ones
                                           -- (cascade FKs are left untouched)
  loop
    execute format(
      'alter table %I drop constraint %I', r.tbl, r.conname
    );
    execute format(
      'alter table %I add constraint %I foreign key (%I) references profiles(id) on delete set null',
      r.tbl, r.conname, r.col
    );
  end loop;
end $$;
