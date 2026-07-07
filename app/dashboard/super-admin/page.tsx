import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";
import { clsx } from "@/lib/clsx";
import { formatDate } from "@/lib/format";
import { hasRole, type Handoff, type Profile, type Project, type Task } from "@/lib/types";

type ProjectWithCountry = Project & { countries: { name: string } | null };

const PAGE_SIZE = 10;

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") redirect("/dashboard/overview");

  const supabase = createClient();
  const [
    { data: projects },
    { data: profiles },
    { data: seoTasks, count: seoCount },
    { data: handoffs },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, countries(name)")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
    (() => {
      const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
      const from = (page - 1) * PAGE_SIZE;
      return supabase
        .from("tasks")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
    })(),
    supabase
      .from("handoffs")
      .select("*")
      .not("dev_summary", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  const projectList = (projects as ProjectWithCountry[]) ?? [];
  const people = (profiles as Profile[]) ?? [];
  const profileById = new Map(people.map((p) => [p.id, p]));
  const projectById = new Map(projectList.map((p) => [p.id, p]));
  const seoIds = new Set(people.filter((p) => hasRole(p, "seo")).map((p) => p.id));

  // SEO-owned tasks only, paginated server-side but filtered to SEO here.
  const allSeoTasks = ((seoTasks as Task[]) ?? []).filter(
    (t) => t.assigned_to && seoIds.has(t.assigned_to),
  );

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil((seoCount ?? 0) / PAGE_SIZE));

  const inProgress = projectList.filter(
    (p) => (p.current_phase ?? "") !== "complete",
  );
  const completed = projectList.filter((p) => p.current_phase === "complete");
  const handoffList = (handoffs as Handoff[]) ?? [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center gap-2">
        <Icon name="visibility" className="text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Super admin overview</h2>
          <p className="text-sm text-ink-muted">
            Read-only view of everything across the agency.
          </p>
        </div>
      </div>

      {/* Project blocks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProjectGroup
          title="In progress"
          icon="bolt"
          tone="progress"
          projects={inProgress}
        />
        <ProjectGroup
          title="Completed"
          icon="check_circle"
          tone="done"
          projects={completed}
        />
      </div>

      {/* Developer completion notes */}
      <div className="mt-8">
        <h3 className="mb-2 text-sm font-semibold">Developer completion notes</h3>
        <div className="card divide-y divide-border">
          {handoffList.length === 0 && (
            <p className="p-4 text-sm text-ink-subtle">
              No completion write-ups yet.
            </p>
          )}
          {handoffList.map((h) => (
            <div key={h.id} className="p-4">
              <div className="mb-1 flex items-center justify-between">
                <Link
                  href={`/dashboard/project/${h.project_id}`}
                  className="text-sm font-medium hover:text-primary"
                >
                  {projectById.get(h.project_id)?.name ?? "Project"}
                </Link>
                <span className="text-xs text-ink-subtle">
                  {formatDate(h.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink-muted">
                {h.dev_summary}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* SEO tasks table with pagination */}
      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">SEO tasks</h3>
          <span className="text-xs text-ink-subtle">
            {seoCount ?? 0} tasks · page {page} of {totalPages}
          </span>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted">
              <tr>
                {["Task", "Project", "Assigned to", "Status", "Date"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allSeoTasks.map((t) => (
                <tr key={t.id} className="hover:bg-surface-subtle">
                  <td className="px-3 py-2">{t.title}</td>
                  <td className="px-3 py-2 text-ink-muted">
                    {projectById.get(t.project_id)?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-ink-muted">
                    {t.assigned_to
                      ? profileById.get(t.assigned_to)?.full_name ?? "—"
                      : "—"}
                  </td>
                  <td className="px-3 py-2 capitalize text-ink-muted">
                    {t.status}
                  </td>
                  <td className="px-3 py-2 text-ink-subtle">
                    {formatDate(t.created_at)}
                  </td>
                </tr>
              ))}
              {allSeoTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-ink-subtle">
                    No SEO tasks on this page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <PageLink page={page - 1} disabled={page <= 1} label="Previous" />
          <PageLink page={page + 1} disabled={page >= totalPages} label="Next" />
        </div>
      </div>
    </div>
  );
}

function ProjectGroup({
  title,
  icon,
  tone,
  projects,
}: {
  title: string;
  icon: string;
  tone: "progress" | "done";
  projects: ProjectWithCountry[];
}) {
  const toneClass =
    tone === "done"
      ? "text-status-done-text"
      : "text-status-progress-text";
  return (
    <div>
      <h3 className={clsx("mb-2 flex items-center gap-1.5 text-sm font-semibold", toneClass)}>
        <Icon name={icon} size={18} />
        {title}
        <span className="text-ink-subtle">({projects.length})</span>
      </h3>
      <div className="space-y-2">
        {projects.length === 0 && (
          <p className="card p-4 text-sm text-ink-subtle">None.</p>
        )}
        {projects.map((p) => {
          const href =
            p.project_type === "gmb"
              ? `/dashboard/gmb/${p.id}`
              : `/dashboard/project/${p.id}`;
          return (
            <div key={p.id} className="card p-3">
              <div className="flex items-center justify-between">
                <Link href={href} className="font-medium hover:text-primary">
                  {p.name}
                </Link>
                <span className="badge bg-surface-muted capitalize text-ink-muted">
                  {p.project_type === "gmb" ? "GMB" : p.current_phase ?? "—"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-ink-subtle">
                <span>{p.countries?.name ?? "—"}</span>
                <Link
                  href={`/dashboard/sitelinks?project=${p.id}`}
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Icon name="table_chart" size={14} />
                  View sitelinks
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageLink({
  page,
  disabled,
  label,
}: {
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="btn-secondary cursor-not-allowed opacity-50">{label}</span>
    );
  }
  return (
    <Link href={`/dashboard/super-admin?page=${page}`} className="btn-secondary">
      {label}
    </Link>
  );
}
