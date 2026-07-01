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

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never exposed to the browser)

### 3. Apply the schema

Either with the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push          # applies supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # or run seed.sql in the SQL editor
```

…or simply paste `supabase/migrations/0001_init.sql` then `supabase/seed.sql`
into the Supabase SQL editor and run them. This creates all tables, RLS
policies, the `project-assets` storage bucket, and seeds the checklist
templates + starter countries.

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

## Notes

- **Search console** tab is an intentional placeholder — wiring the real Google
  Search Console API needs OAuth and is a separate integration step.
