# Project Hub

Multi-country project and task management for a digital agency. Roles: manager,
developer, designer, SEO specialist, GMB specialist.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase
(Postgres + Auth + RLS + Storage) · deployable on Vercel.

## Getting started

### 1. Create a Supabase project

From <https://supabase.com> create a project, then grab the API credentials
(Project Settings → API).

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in (see `.env.local.example` for the full annotated list):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never exposed to the browser)
- `NEXT_PUBLIC_SITE_URL` — absolute origin, for links in notifications
- `TEAMS_WEBHOOK_URL` — optional; Teams channel webhook (see below)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — web-push keys
- `VAPID_SUBJECT` — a `mailto:` address
- `CRON_SECRET` — random string protecting the reminder cron

### 3. Apply the schema

Either with the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # or run seed.sql in the SQL editor
```

…or simply paste each file in `supabase/migrations/` **in order**
(`0001_init.sql` → `0002_notifications.sql` → `0003_membership.sql`) then
`supabase/seed.sql` into the Supabase SQL editor and run them. This creates all
tables, RLS policies, the `project-assets` storage bucket, and seeds the
checklist templates + starter countries.

### 4. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Sign up, complete onboarding (pick a role — the
first account you create should be a **manager** to be able to add countries
and projects).

## Architecture

| Area | Location |
| --- | --- |
| Supabase clients | `lib/supabase/{client,server,middleware}.ts` |
| Auth helpers | `lib/auth.ts`, root `middleware.ts` |
| Domain types | `lib/types.ts` |
| Server actions | `app/**/actions.ts` |
| Dashboard shell | `app/dashboard/layout.tsx` + `components/sidebar.tsx`, `components/topbar.tsx` |
| Project workspace | `app/dashboard/project/[projectId]/` |
| Kanban | `app/dashboard/project/[projectId]/kanban/` |
| GMB | `app/dashboard/gmb/[projectId]/` |
| SQL schema / seed | `supabase/` |

Row Level Security: managers read/write everything; other roles read all and
write only rows they own (assigned task, owned project role, GMB task they're
assigned). Enforced in Postgres via the `is_manager()` / `owns_project()`
helpers, and mirrored in the UI for affordance.

## Deploy on Vercel

1. Push to a Git repo and import it into Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` as Vercel environment variables.
3. Add your Vercel URL to Supabase Auth → URL configuration (redirect URLs).

## Notifications & PWA

Task events fan out to three places: an in-app bell (top bar), web push (even
when the app is closed), and a Microsoft Teams channel.

**Events:** task assigned · handoff to SEO · GMB listing live · task due
soon/overdue (daily cron).

### Microsoft Teams (optional)

No Azure app needed. In your Teams channel: **··· → Workflows →** add the
template **"Post to a channel when a webhook request is received"**, pick the
team + channel, and copy the generated URL into `TEAMS_WEBHOOK_URL`. Leave it
blank to disable Teams posts — everything else still works.

### Web push

1. Generate VAPID keys:
   `node -e "console.log(require('web-push').generateVAPIDKeys())"`
   and put them in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
2. Run `supabase/migrations/0002_notifications.sql` (adds `push_subscriptions`
   and `notifications` tables).
3. Each user clicks **Enable push notifications** in the bell dropdown to
   subscribe that device. On iPhone the app must be **Added to Home Screen**
   first (an iOS restriction), then push works from the installed PWA.

Push and in-app notifications require `SUPABASE_SERVICE_ROLE_KEY` (the server
reads other users' subscriptions with it).

### Installable PWA

`app/manifest.webmanifest` + `public/sw.js` make the app installable
(standalone display, home-screen icon). The service worker also receives push
and handles notification clicks.

### Due-task reminder cron

`vercel.json` schedules `GET /api/cron/due-tasks` daily at 08:00 UTC. It's
protected by `CRON_SECRET` (Vercel sends it as a Bearer token automatically).
To change the time, edit the `schedule` cron expression.

## Notes

- **Search console** tab is an intentional placeholder — wiring the real Google
  Search Console API needs OAuth and is a separate integration step.
