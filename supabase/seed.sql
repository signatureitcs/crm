-- Project Hub — seed data.
-- Run after 0001_init.sql:  supabase db reset  (applies migrations + seed)
-- or paste into the SQL editor.

-- Checklist templates --------------------------------------------------
insert into checklist_templates (role, label, sort_order) values
  ('developer', 'Sitelinks added', 1),
  ('developer', 'Phone number format correct', 2),
  ('developer', 'Sticky call button (mobile)', 3),
  ('developer', 'Form working', 4),
  ('designer', 'Images converted to webp', 1),
  ('designer', 'Logo delivered', 2),
  ('designer', 'Favicon set', 3),
  ('seo', 'Sitemap generated', 1),
  ('seo', 'Sitemap indexed to Google', 2)
on conflict do nothing;

-- Starter countries ----------------------------------------------------
insert into countries (name) values
  ('France'),
  ('UK'),
  ('Canada'),
  ('Spain')
on conflict (name) do nothing;
