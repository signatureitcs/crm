-- Project Hub — checklist justifications + developer completion write-up.
-- Run after 0003_membership.sql.

-- Per-item justification text (e.g. the actual phone format, the form fields).
alter table checklist_completions add column if not exists note text;

-- The developer's detailed start-to-end description, captured at handoff.
alter table handoffs add column if not exists dev_summary text;
