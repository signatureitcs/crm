-- ============================================================================
-- Signature CRM — COMPLETE setup / repair script (idempotent).
-- Safe to run on a fresh project OR an existing one. It creates any missing
-- tables/columns, (re)defines all helper functions and triggers FIRST, then
-- drops and recreates every RLS policy so the final state is guaranteed
-- correct regardless of what was applied before.
--
-- Run the WHOLE file at once in the Supabase SQL editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES + COLUMNS (create if missing; add evolved columns if missing)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null,
  created_at timestamptz default now()
);
alter table profiles add column if not exists roles text[] not null default '{}';
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists presence text not null default 'offline';
alter table profiles add column if not exists approval_status text not null default 'pending';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('manager','developer','designer','seo','gmb','qa','super_admin'));
alter table profiles drop constraint if exists profiles_presence_check;
alter table profiles add constraint profiles_presence_check
  check (presence in ('online','offline'));
alter table profiles drop constraint if exists profiles_approval_status_check;
alter table profiles add constraint profiles_approval_status_check
  check (approval_status in ('pending','approved','rejected','suspended'));

create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_id uuid references countries(id) on delete set null,
  project_type text not null check (project_type in ('website','gmb')),
  current_phase text check (current_phase in ('design','development','seo','complete')),
  developer_id uuid,
  designer_id uuid,
  seo_id uuid,
  created_at timestamptz default now()
);
alter table projects add column if not exists description text;
alter table projects add column if not exists client_name text;
alter table projects add column if not exists client_contact text;
alter table projects add column if not exists qa_status text default 'pending';
alter table projects add column if not exists qa_reviewer_id uuid;
alter table projects add column if not exists qa_reviewed_at timestamptz;
alter table projects add column if not exists qa_note text;
alter table projects add column if not exists sitelink_columns text[]
  not null default array['Page URL','Sitelink 1','Sitelink 2','Sitelink 3'];

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique (project_id, profile_id)
);

create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  phase_name text not null check (phase_name in ('design','development','seo')),
  status text not null default 'locked' check (status in ('locked','in_progress','complete')),
  assigned_to uuid references profiles(id) on delete set null,
  unlocked_at timestamptz,
  unique (project_id, phase_name)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  title text not null,
  assigned_to uuid references profiles(id) on delete set null,
  status text not null default 'todo' check (status in ('todo','processing','completed')),
  due_date timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists checklist_templates (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('developer','designer','seo')),
  label text not null,
  sort_order int default 0
);

create table if not exists checklist_completions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete cascade,
  template_id uuid references checklist_templates(id) on delete cascade,
  checked boolean default false,
  checked_by uuid references profiles(id) on delete set null,
  checked_at timestamptz,
  unique (project_id, template_id)
);
alter table checklist_completions add column if not exists note text;

create table if not exists handoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  from_role text,
  to_profile_id uuid references profiles(id) on delete set null,
  checklist_snapshot jsonb,
  created_at timestamptz default now()
);
alter table handoffs add column if not exists dev_summary text;

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  file_url text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists sitelinks_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  page_url text, sitelink_1 text, sitelink_2 text, sitelink_3 text,
  sort_order int default 0
);
alter table sitelinks_rows add column if not exists cells jsonb not null default '{}'::jsonb;

create table if not exists seo_daily_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  note text not null,
  created_at timestamptz default now()
);

create table if not exists gmb_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_type text check (task_type in ('emails_assigned','reviews_done','listing_live')),
  assigned_to uuid references profiles(id) on delete set null,
  status text default 'todo' check (status in ('todo','in_progress','done')),
  listing_link text,
  updated_at timestamptz default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null, body text, url text, kind text,
  read boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null, auth text not null, user_agent text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS  (defined before any policy references them)
-- ---------------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager');
$$;

create or replace function public.is_qa()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'qa');
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin');
$$;

create or replace function public.can_read_all()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role in ('manager','qa','super_admin'));
$$;

create or replace function public.owns_project(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = pid and (pr.developer_id = auth.uid() or pr.designer_id = auth.uid() or pr.seo_id = auth.uid())
  ) or exists (
    select 1 from public.project_members pm where pm.project_id = pid and pm.profile_id = auth.uid()
  );
$$;

-- Keep primary role in sync with roles[] (manager/super_admin exclusive).
create or replace function public.sync_primary_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.roles is null or cardinality(new.roles) = 0 then new.roles := array[new.role]; end if;
  if 'manager' = any(new.roles) then new.roles := array['manager']; new.role := 'manager';
  elsif 'super_admin' = any(new.roles) then new.roles := array['super_admin']; new.role := 'super_admin';
  else new.role := new.roles[1]; end if;
  return new;
end $$;

-- First account -> approved manager; service-role inserts -> approved; else pending.
create or replace function public.enforce_profile_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.profiles) = 0 then
    new.approval_status := 'approved'; new.roles := array['manager']; new.role := 'manager';
  elsif auth.uid() is null then
    new.approval_status := 'approved';
  else
    new.approval_status := 'pending';
  end if;
  return new;
end $$;

drop trigger if exists trg_profile_approval on profiles;
create trigger trg_profile_approval before insert on profiles
  for each row execute function public.enforce_profile_approval();
drop trigger if exists trg_sync_primary_role on profiles;
create trigger trg_sync_primary_role before insert or update on profiles
  for each row execute function public.sync_primary_role();

-- ---------------------------------------------------------------------------
-- 3. ENABLE RLS + DROP EVERY EXISTING POLICY (clears stale/restrictive ones)
-- ---------------------------------------------------------------------------
do $$
declare t text; p record;
begin
  foreach t in array array[
    'profiles','countries','projects','project_members','phases','tasks',
    'checklist_templates','checklist_completions','handoffs','assets',
    'sitelinks_rows','seo_daily_logs','gmb_tasks','comments',
    'notifications','push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. RECREATE POLICIES (final correct set)
-- ---------------------------------------------------------------------------
-- profiles
create policy "profiles_read"   on profiles for select to authenticated using (true);
create policy "profiles_insert" on profiles for insert to authenticated with check (id = auth.uid() or public.is_manager());
create policy "profiles_update" on profiles for update to authenticated using (id = auth.uid() or public.is_manager()) with check (id = auth.uid() or public.is_manager());
create policy "profiles_delete" on profiles for delete to authenticated using (public.is_manager());

-- countries
create policy "countries_read"  on countries for select to authenticated using (true);
create policy "countries_write" on countries for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- projects
create policy "projects_read"      on projects for select to authenticated using (public.can_read_all() or public.owns_project(id));
create policy "projects_insert"    on projects for insert to authenticated with check (not public.is_super_admin());
create policy "projects_update"    on projects for update to authenticated using (public.is_manager() or public.owns_project(id)) with check (public.is_manager() or public.owns_project(id));
create policy "projects_qa_update" on projects for update to authenticated using (public.is_qa()) with check (public.is_qa());
create policy "projects_delete"    on projects for delete to authenticated using (public.is_manager());

-- project_members
create policy "pm_select" on project_members for select to authenticated using (public.can_read_all() or profile_id = auth.uid() or public.owns_project(project_id));
create policy "pm_insert" on project_members for insert to authenticated with check (not public.is_super_admin());
create policy "pm_delete" on project_members for delete to authenticated using (public.is_manager() or public.owns_project(project_id));

-- phases
create policy "phases_read"   on phases for select to authenticated using (public.can_read_all() or public.owns_project(project_id));
create policy "phases_insert" on phases for insert to authenticated with check (not public.is_super_admin());
create policy "phases_update" on phases for update to authenticated using (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id)) with check (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id));
create policy "phases_delete" on phases for delete to authenticated using (public.is_manager());

-- tasks
create policy "tasks_read"   on tasks for select to authenticated using (public.can_read_all() or public.owns_project(project_id) or assigned_to = auth.uid());
create policy "tasks_insert" on tasks for insert to authenticated with check (public.is_manager() or public.is_qa() or public.owns_project(project_id) or created_by = auth.uid());
create policy "tasks_update" on tasks for update to authenticated using (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id)) with check (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id));
create policy "tasks_delete" on tasks for delete to authenticated using (public.is_manager() or created_by = auth.uid());

-- checklist_templates
create policy "templates_read"  on checklist_templates for select to authenticated using (true);
create policy "templates_write" on checklist_templates for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- checklist_completions
create policy "completions_read"  on checklist_completions for select to authenticated using (public.can_read_all() or public.owns_project(project_id));
create policy "completions_write" on checklist_completions for all to authenticated using (public.is_manager() or public.owns_project(project_id)) with check (public.is_manager() or public.owns_project(project_id));

-- handoffs
create policy "handoffs_read"   on handoffs for select to authenticated using (public.can_read_all() or public.owns_project(project_id));
create policy "handoffs_insert" on handoffs for insert to authenticated with check (public.is_manager() or public.owns_project(project_id));

-- assets
create policy "assets_read"  on assets for select to authenticated using (public.can_read_all() or public.owns_project(project_id));
create policy "assets_write" on assets for all to authenticated using (public.is_manager() or public.owns_project(project_id)) with check (public.is_manager() or public.owns_project(project_id));

-- sitelinks_rows
create policy "sitelinks_read"  on sitelinks_rows for select to authenticated using (public.can_read_all() or public.owns_project(project_id));
create policy "sitelinks_write" on sitelinks_rows for all to authenticated using (public.is_manager() or public.owns_project(project_id)) with check (public.is_manager() or public.owns_project(project_id));

-- seo_daily_logs
create policy "seo_logs_read"  on seo_daily_logs for select to authenticated using (public.can_read_all() or public.owns_project(project_id));
create policy "seo_logs_write" on seo_daily_logs for all to authenticated using (public.is_manager() or public.owns_project(project_id)) with check (public.is_manager() or public.owns_project(project_id));

-- gmb_tasks
create policy "gmb_read"   on gmb_tasks for select to authenticated using (public.can_read_all() or public.owns_project(project_id));
create policy "gmb_insert" on gmb_tasks for insert to authenticated with check (not public.is_super_admin());
create policy "gmb_update" on gmb_tasks for update to authenticated using (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id)) with check (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id));
create policy "gmb_delete" on gmb_tasks for delete to authenticated using (public.is_manager());

-- comments
create policy "comments_select" on comments for select to authenticated using (public.can_read_all() or public.owns_project(project_id));
create policy "comments_insert" on comments for insert to authenticated with check (public.is_manager() or public.is_qa() or public.owns_project(project_id));
create policy "comments_delete" on comments for delete to authenticated using (public.is_manager() or author_id = auth.uid());

-- notifications
create policy "notifications_select_own" on notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_insert"     on notifications for insert to authenticated with check (auth.uid() is not null);

-- push_subscriptions
create policy "push_subs_select_own" on push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "push_subs_insert_own" on push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "push_subs_update_own" on push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subs_delete_own" on push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. FKs that must null out on user delete (so a user with work can be removed)
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select con.conname, cl.relname as tbl, att.attname as col
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_class rf on rf.oid = con.confrelid
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f' and rf.relname = 'profiles' and con.confdeltype = 'a'
  loop
    execute format('alter table public.%I drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
      r.tbl, r.conname, r.col);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. STORAGE buckets + policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('project-assets','project-assets',true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars','avatars',true)
  on conflict (id) do nothing;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects'
           and policyname in ('asset_objects_read','asset_objects_insert','asset_objects_delete',
                              'avatars_read','avatars_insert','avatars_update','avatars_delete')
  loop execute format('drop policy if exists %I on storage.objects', p.policyname); end loop;
end $$;

create policy "asset_objects_read"   on storage.objects for select to authenticated using (bucket_id = 'project-assets');
create policy "asset_objects_insert" on storage.objects for insert to authenticated with check (bucket_id = 'project-assets' and (public.is_manager() or public.owns_project(((storage.foldername(name))[1])::uuid)));
create policy "asset_objects_delete" on storage.objects for delete to authenticated using (bucket_id = 'project-assets' and (public.is_manager() or public.owns_project(((storage.foldername(name))[1])::uuid)));
create policy "avatars_read"   on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "avatars_insert" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 7. SEED (idempotent)
-- ---------------------------------------------------------------------------
insert into checklist_templates (role, label, sort_order) values
  ('developer','Sitelinks added',1),
  ('developer','Phone number format correct',2),
  ('developer','Sticky call button (mobile)',3),
  ('developer','Form working',4),
  ('designer','Images converted to webp',1),
  ('designer','Logo delivered',2),
  ('designer','Favicon set',3),
  ('seo','Sitemap generated',1),
  ('seo','Sitemap indexed to Google',2)
on conflict do nothing;

-- Backfill roles[] for any existing rows.
update profiles set roles = array[role] where cardinality(roles) = 0;
