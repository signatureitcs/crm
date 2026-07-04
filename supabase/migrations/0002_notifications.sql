-- Project Hub — notifications: web-push subscriptions + in-app notification feed.
-- Run after 0001_init.sql.

-- Web-push subscriptions (one row per browser/device per user) ---------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists idx_push_subs_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

-- A user manages only their own device subscriptions. Sending happens with
-- the service-role key (bypasses RLS).
create policy "push_subs_select_own" on push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subs_insert_own" on push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "push_subs_update_own" on push_subscriptions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subs_delete_own" on push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- In-app notification feed ---------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  url text,
  kind text,
  read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user on notifications(user_id, read);

alter table notifications enable row level security;

-- Recipients read and update (mark-read) their own notifications.
create policy "notifications_select_own" on notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Any authenticated user may create a notification for someone (server-side
-- dispatch controls this); the service-role key is used by the cron job.
create policy "notifications_insert" on notifications
  for insert to authenticated with check (auth.uid() is not null);
