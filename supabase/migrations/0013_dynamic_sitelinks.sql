-- Signature CRM — dynamic sitelink columns (headers + count come from CSV).
-- Run after 0012_user_admin.sql.

-- Per-project column headers (default matches the old fixed layout).
alter table projects add column if not exists sitelink_columns text[]
  not null default array['Page URL','Sitelink 1','Sitelink 2','Sitelink 3'];

-- Row data keyed by header, so any number/name of columns is supported.
alter table sitelinks_rows add column if not exists cells jsonb
  not null default '{}'::jsonb;

-- Backfill existing rows from the old fixed columns.
update sitelinks_rows
set cells = jsonb_strip_nulls(
  jsonb_build_object(
    'Page URL', page_url,
    'Sitelink 1', sitelink_1,
    'Sitelink 2', sitelink_2,
    'Sitelink 3', sitelink_3
  )
)
where cells = '{}'::jsonb
  and (page_url is not null or sitelink_1 is not null
       or sitelink_2 is not null or sitelink_3 is not null);
