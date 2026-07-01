-- Project Hub — initial schema, RLS, helpers, storage.
-- Run via: supabase db push  (or paste into the Supabase SQL editor).

-- =========================================================================
-- Tables
-- =========================================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('manager','developer','designer','seo','gmb')),
  created_at timestamptz default now()
);

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
  developer_id uuid references profiles(id),
  designer_id uuid references profiles(id),
  seo_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  phase_name text not null check (phase_name in ('design','development','seo')),
  status text not null default 'locked' check (status in ('locked','in_progress','complete')),
  assigned_to uuid references profiles(id),
  unlocked_at timestamptz,
  unique (project_id, phase_name)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  title text not null,
  assigned_to uuid references profiles(id),
  status text not null default 'todo' check (status in ('todo','processing','completed')),
  due_date timestamptz,
  created_by uuid references profiles(id),
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
  checked_by uuid references profiles(id),
  checked_at timestamptz,
  unique (project_id, template_id)
);

create table if not exists handoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  from_role text,
  to_profile_id uuid references profiles(id),
  checklist_snapshot jsonb,
  created_at timestamptz default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  file_url text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists sitelinks_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  page_url text,
  sitelink_1 text,
  sitelink_2 text,
  sitelink_3 text,
  sort_order int default 0
);

create table if not exists seo_daily_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  author_id uuid references profiles(id),
  note text not null,
  created_at timestamptz default now()
);

create table if not exists gmb_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_type text check (task_type in ('emails_assigned','reviews_done','listing_live')),
  assigned_to uuid references profiles(id),
  status text default 'todo' check (status in ('todo','in_progress','done')),
  listing_link text,
  updated_at timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_projects_country on projects(country_id);
create index if not exists idx_phases_project on phases(project_id);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_assigned on tasks(assigned_to);
create index if not exists idx_completions_project on checklist_completions(project_id);
create index if not exists idx_assets_project on assets(project_id);
create index if not exists idx_sitelinks_project on sitelinks_rows(project_id);
create index if not exists idx_seo_logs_project on seo_daily_logs(project_id);
create index if not exists idx_gmb_project on gmb_tasks(project_id);

-- =========================================================================
-- Helper functions (security definer to avoid recursive RLS on profiles)
-- =========================================================================

create or replace function public.is_manager()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'manager'
  );
$$;

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
  );
$$;

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table profiles enable row level security;
alter table countries enable row level security;
alter table projects enable row level security;
alter table phases enable row level security;
alter table tasks enable row level security;
alter table checklist_templates enable row level security;
alter table checklist_completions enable row level security;
alter table handoffs enable row level security;
alter table assets enable row level security;
alter table sitelinks_rows enable row level security;
alter table seo_daily_logs enable row level security;
alter table gmb_tasks enable row level security;

-- profiles ---------------------------------------------------------------
create policy "profiles_read" on profiles
  for select to authenticated using (true);
create policy "profiles_insert_self" on profiles
  for insert to authenticated with check (id = auth.uid() or public.is_manager());
create policy "profiles_update" on profiles
  for update to authenticated
  using (id = auth.uid() or public.is_manager())
  with check (id = auth.uid() or public.is_manager());
create policy "profiles_delete_manager" on profiles
  for delete to authenticated using (public.is_manager());

-- countries --------------------------------------------------------------
create policy "countries_read" on countries
  for select to authenticated using (true);
create policy "countries_write" on countries
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- projects ---------------------------------------------------------------
create policy "projects_read" on projects
  for select to authenticated using (true);
create policy "projects_write" on projects
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- phases -----------------------------------------------------------------
create policy "phases_read" on phases
  for select to authenticated using (true);
create policy "phases_insert" on phases
  for insert to authenticated with check (public.is_manager());
create policy "phases_update" on phases
  for update to authenticated
  using (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id))
  with check (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id));
create policy "phases_delete" on phases
  for delete to authenticated using (public.is_manager());

-- tasks ------------------------------------------------------------------
create policy "tasks_read" on tasks
  for select to authenticated using (true);
create policy "tasks_insert" on tasks
  for insert to authenticated
  with check (public.is_manager() or public.owns_project(project_id) or created_by = auth.uid());
create policy "tasks_update" on tasks
  for update to authenticated
  using (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id))
  with check (public.is_manager() or assigned_to = auth.uid() or public.owns_project(project_id));
create policy "tasks_delete" on tasks
  for delete to authenticated
  using (public.is_manager() or created_by = auth.uid());

-- checklist_templates ----------------------------------------------------
create policy "templates_read" on checklist_templates
  for select to authenticated using (true);
create policy "templates_write" on checklist_templates
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- checklist_completions --------------------------------------------------
create policy "completions_read" on checklist_completions
  for select to authenticated using (true);
create policy "completions_write" on checklist_completions
  for all to authenticated
  using (public.is_manager() or public.owns_project(project_id))
  with check (public.is_manager() or public.owns_project(project_id));

-- handoffs ---------------------------------------------------------------
create policy "handoffs_read" on handoffs
  for select to authenticated using (true);
create policy "handoffs_insert" on handoffs
  for insert to authenticated
  with check (public.is_manager() or public.owns_project(project_id));

-- assets -----------------------------------------------------------------
create policy "assets_read" on assets
  for select to authenticated using (true);
create policy "assets_write" on assets
  for all to authenticated
  using (public.is_manager() or public.owns_project(project_id))
  with check (public.is_manager() or public.owns_project(project_id));

-- sitelinks_rows ---------------------------------------------------------
create policy "sitelinks_read" on sitelinks_rows
  for select to authenticated using (true);
create policy "sitelinks_write" on sitelinks_rows
  for all to authenticated
  using (public.is_manager() or public.owns_project(project_id))
  with check (public.is_manager() or public.owns_project(project_id));

-- seo_daily_logs ---------------------------------------------------------
create policy "seo_logs_read" on seo_daily_logs
  for select to authenticated using (true);
create policy "seo_logs_write" on seo_daily_logs
  for all to authenticated
  using (public.is_manager() or public.owns_project(project_id))
  with check (public.is_manager() or public.owns_project(project_id));

-- gmb_tasks --------------------------------------------------------------
create policy "gmb_read" on gmb_tasks
  for select to authenticated using (true);
create policy "gmb_write" on gmb_tasks
  for all to authenticated
  using (public.is_manager() or assigned_to = auth.uid())
  with check (public.is_manager() or assigned_to = auth.uid());

-- =========================================================================
-- Storage bucket + policies
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', true)
on conflict (id) do nothing;

create policy "asset_objects_read" on storage.objects
  for select to authenticated using (bucket_id = 'project-assets');

create policy "asset_objects_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-assets'
    and (
      public.is_manager()
      or public.owns_project(((storage.foldername(name))[1])::uuid)
    )
  );

create policy "asset_objects_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-assets'
    and (
      public.is_manager()
      or public.owns_project(((storage.foldername(name))[1])::uuid)
    )
  );
