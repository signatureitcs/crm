import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";
import { clsx } from "@/lib/clsx";
import { formatDate } from "@/lib/format";
import {
  ROLE_LABELS,
  type Comment,
  type Handoff,
  type Profile,
  type Project,
  type ProjectMember,
  type SeoDailyLog,
  type Task,
} from "@/lib/types";

type ProjectWithCountry = Project & { countries: { name: string } | null };

function qaBadge(status: string | null | undefined): {
  label: string;
  className: string;
} {
  switch (status) {
    case "approved":
      return { label: "Approved", className: "bg-status-done-bg text-status-done-text" };
    case "rejected":
      return { label: "Needs fixes", className: "bg-status-error-bg text-status-error-text" };
    default:
      return { label: "Pending", className: "bg-status-todo-bg text-status-todo-text" };
  }
}

const STAGE_STYLE: Record<string, string> = {
  design: "bg-status-progress-bg text-status-progress-text",
  development: "bg-status-progress-bg text-status-progress-text",
  seo: "bg-status-progress-bg text-status-progress-text",
  complete: "bg-status-done-bg text-status-done-text",
};

export default async function ManagerDashboardPage() {
  const profile = await requireProfile();
  if (profile.role !== "manager") redirect("/dashboard/overview");

  const supabase = createClient();
  const [
    { data: projects },
    { data: tasks },
    { data: profiles },
    { data: members },
    { data: handoffs },
    { data: seoLogs },
    { data: comments },
  ] = await Promise.all([
    supabase.from("projects").select("*, countries(name)").order("created_at", { ascending: false }),
    supabase.from("tasks").select("*"),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("project_members").select("*"),
    supabase.from("handoffs").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("seo_daily_logs").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("comments").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  const projectList = (projects as ProjectWithCountry[]) ?? [];
  const taskList = (tasks as Task[]) ?? [];
  const people = (profiles as Profile[]) ?? [];
  const memberList = (members as ProjectMember[]) ?? [];
  const handoffList = (handoffs as Handoff[]) ?? [];
  const logList = (seoLogs as SeoDailyLog[]) ?? [];
  const commentList = (comments as Comment[]) ?? [];

  const profileById = new Map(people.map((p) => [p.id, p]));
  const projectById = new Map(projectList.map((p) => [p.id, p]));

  // Members per project (explicit members + leads).
  const membersByProject = new Map<string, Set<string>>();
  for (const p of projectList) {
    const set = new Set<string>(
      [p.developer_id, p.designer_id, p.seo_id].filter(Boolean) as string[],
    );
    membersByProject.set(p.id, set);
  }
  for (const m of memberList) {
    membersByProject.get(m.project_id)?.add(m.profile_id);
  }

  // Task counts per project + per user.
  const projStats = new Map<string, { todo: number; processing: number; completed: number }>();
  const userStats = new Map<string, { todo: number; processing: number; completed: number; tasks: Task[] }>();
  for (const t of taskList) {
    const ps = projStats.get(t.project_id) ?? { todo: 0, processing: 0, completed: 0 };
    ps[t.status] += 1;
    projStats.set(t.project_id, ps);
    if (t.assigned_to) {
      const us = userStats.get(t.assigned_to) ?? { todo: 0, processing: 0, completed: 0, tasks: [] };
      us[t.status] += 1;
      us.tasks.push(t);
      userStats.set(t.assigned_to, us);
    }
  }

  const stats = {
    projects: projectList.length,
    active: projectList.filter((p) => p.current_phase && p.current_phase !== "complete").length,
    complete: projectList.filter((p) => p.current_phase === "complete").length,
    todo: taskList.filter((t) => t.status === "todo").length,
    processing: taskList.filter((t) => t.status === "processing").length,
    completed: taskList.filter((t) => t.status === "completed").length,
    qaApproved: projectList.filter((p) => p.qa_status === "approved").length,
    qaRejected: projectList.filter((p) => p.qa_status === "rejected").length,
  };

  // Recent activity feed (handoffs + SEO logs).
  const activity = [
    ...handoffList.map((h) => ({
      ts: h.created_at,
      icon: "forward",
      text: `Handed off ${projectById.get(h.project_id)?.name ?? "a project"} to ${
        h.to_profile_id ? profileById.get(h.to_profile_id)?.full_name ?? "SEO" : "SEO"
      }`,
    })),
    ...logList.map((l) => ({
      ts: l.created_at,
      icon: "event_note",
      text: `${l.author_id ? profileById.get(l.author_id)?.full_name ?? "Someone" : "Someone"} logged a note on ${
        projectById.get(l.project_id)?.name ?? "a project"
      }: ${l.note.slice(0, 60)}`,
    })),
    ...commentList.map((c) => ({
      ts: c.created_at,
      icon: "chat_bubble",
      text: `${c.author_id ? profileById.get(c.author_id)?.full_name ?? "Someone" : "Someone"} commented on ${
        projectById.get(c.project_id)?.name ?? "a project"
      }: ${c.body.slice(0, 60)}`,
    })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 12);

  const teamMembers = people.filter((p) => p.role !== "manager");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Manager dashboard</h2>
        <p className="text-sm text-ink-muted">Everything happening across the agency.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Projects" value={stats.projects} icon="dns" />
        <Stat label="Active" value={stats.active} icon="bolt" tone="progress" />
        <Stat label="Complete" value={stats.complete} icon="check_circle" tone="done" />
        <Stat label="To do" value={stats.todo} icon="radio_button_unchecked" />
        <Stat label="In progress" value={stats.processing} icon="sync" tone="progress" />
        <Stat label="Done tasks" value={stats.completed} icon="task_alt" tone="done" />
        <Stat label="QA approved" value={stats.qaApproved} icon="verified" tone="done" />
        <Stat label="QA needs fixes" value={stats.qaRejected} icon="report" tone="error" />
      </div>

      {/* Team status (presence) */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold">Team status</h3>
        <div className="card flex flex-wrap gap-2 p-4">
          {teamMembers.length === 0 && (
            <p className="text-sm text-ink-subtle">No team members yet.</p>
          )}
          {teamMembers.map((u) => {
            const online = u.presence === "online";
            const processing = userStats.get(u.id)?.processing ?? 0;
            const state = !online ? "offline" : processing > 0 ? "working" : "free";
            const styles = {
              working: "border-status-progress-text/30 bg-status-progress-bg text-status-progress-text",
              free: "border-status-done-text/30 bg-status-done-bg text-status-done-text",
              offline: "border-border bg-surface-subtle text-ink-subtle",
            }[state];
            const dot = {
              working: "bg-status-progress-text",
              free: "bg-status-done-text",
              offline: "bg-ink-subtle",
            }[state];
            const labelText = {
              working: "working",
              free: "free",
              offline: "offline",
            }[state];
            return (
              <span
                key={u.id}
                className={clsx(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                  styles,
                )}
                title={`${u.full_name} · ${ROLE_LABELS[u.role]} · ${labelText}`}
              >
                <span className={clsx("h-2 w-2 rounded-full", dot)} />
                {u.full_name}
                <span className="opacity-70">· {labelText}</span>
              </span>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 text-xs text-ink-subtle">
          <Legend dot="bg-status-progress-text" label="Working (online + active task)" />
          <Legend dot="bg-status-done-text" label="Free (online, no active task)" />
          <Legend dot="bg-ink-subtle" label="Offline" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Projects table */}
        <div className="lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold">Projects</h3>
          <div className="card overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  {["Project", "Country", "Stage", "QA", "Team", "Tasks (todo/doing/done)"].map((h) => (
                    <th key={h} className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projectList.map((p) => {
                  const memberIds = membersByProject.get(p.id) ?? new Set();
                  const memberNames = Array.from(memberIds)
                    .map((id) => profileById.get(id)?.full_name)
                    .filter(Boolean);
                  const ps = projStats.get(p.id) ?? { todo: 0, processing: 0, completed: 0 };
                  const href = p.project_type === "gmb" ? `/dashboard/gmb/${p.id}` : `/dashboard/project/${p.id}`;
                  return (
                    <tr key={p.id} className="hover:bg-surface-subtle">
                      <td className="px-3 py-2">
                        <Link href={href} className="font-medium hover:text-primary">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{p.countries?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={clsx("badge capitalize", STAGE_STYLE[p.current_phase ?? ""] ?? "bg-status-todo-bg text-status-todo-text")}>
                          {p.project_type === "gmb" ? "GMB" : p.current_phase ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {p.project_type === "gmb" ? (
                          <span className="text-ink-subtle">—</span>
                        ) : (
                          <span className={clsx("badge", qaBadge(p.qa_status).className)}>
                            {qaBadge(p.qa_status).label}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">
                        {memberNames.length ? memberNames.join(", ") : "—"}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">
                        <span className="text-ink-subtle">{ps.todo}</span> /{" "}
                        <span className="text-status-progress-text">{ps.processing}</span> /{" "}
                        <span className="text-status-done-text">{ps.completed}</span>
                      </td>
                    </tr>
                  );
                })}
                {projectList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-ink-subtle">
                      No projects yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Recent activity</h3>
          <div className="card p-4">
            {activity.length === 0 && (
              <p className="text-sm text-ink-subtle">No recent activity.</p>
            )}
            <ul className="space-y-3">
              {activity.map((a, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <Icon name={a.icon} size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-ink">{a.text}</p>
                    <p className="text-xs text-ink-subtle">{formatDate(a.ts)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Per-user workload */}
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Team workload</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teamMembers.map((u) => {
            const us = userStats.get(u.id) ?? { todo: 0, processing: 0, completed: 0, tasks: [] };
            const doing = us.tasks.filter((t) => t.status === "processing").slice(0, 4);
            return (
              <div key={u.id} className="card p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                    {u.full_name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{u.full_name}</p>
                    <p className="text-xs text-ink-subtle">{ROLE_LABELS[u.role]}</p>
                  </div>
                </div>
                <div className="mb-3 flex gap-2 text-xs">
                  <Pill label="To do" value={us.todo} className="bg-status-todo-bg text-status-todo-text" />
                  <Pill label="Doing" value={us.processing} className="bg-status-progress-bg text-status-progress-text" />
                  <Pill label="Done" value={us.completed} className="bg-status-done-bg text-status-done-text" />
                </div>
                {doing.length > 0 && (
                  <ul className="space-y-1">
                    {doing.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-xs text-ink-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-progress-text" />
                        <span className="truncate">{t.title}</span>
                        <span className="ml-auto shrink-0 text-ink-subtle">
                          {projectById.get(t.project_id)?.name ?? ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {teamMembers.length === 0 && (
            <p className="text-sm text-ink-subtle">No team members yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: string;
  tone?: "progress" | "done" | "error";
}) {
  const toneClass =
    tone === "done"
      ? "text-status-done-text"
      : tone === "progress"
        ? "text-status-progress-text"
        : tone === "error"
          ? "text-status-error-text"
          : "text-ink-subtle";
  return (
    <div className="card p-4">
      <div className={clsx("mb-1 flex items-center gap-1.5", toneClass)}>
        <Icon name={icon} size={18} />
        <span className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx("h-2 w-2 rounded-full", dot)} />
      {label}
    </span>
  );
}

function Pill({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <span className={clsx("flex-1 rounded-lg px-2 py-1 text-center font-medium", className)}>
      {value} {label}
    </span>
  );
}
