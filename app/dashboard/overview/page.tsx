import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";
import { OverviewTasks, type OverviewTask } from "@/components/overview-tasks";

export default async function OverviewPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, projects(name, project_type, country_id)")
    .eq("assigned_to", profile.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  const list = (tasks as OverviewTask[]) ?? [];
  const counts = {
    todo: list.filter((t) => t.status === "todo").length,
    processing: list.filter((t) => t.status === "processing").length,
    completed: list.filter((t) => t.status === "completed").length,
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">My overview</h2>
        <p className="text-sm text-ink-muted">
          Every task assigned to you across all projects.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="To do" value={counts.todo} icon="radio_button_unchecked" tone="todo" />
        <Stat label="In progress" value={counts.processing} icon="sync" tone="progress" />
        <Stat label="Completed" value={counts.completed} icon="check_circle" tone="done" />
      </div>

      <OverviewTasks tasks={list} />
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
  tone: "todo" | "progress" | "done";
}) {
  const toneClass =
    tone === "done"
      ? "text-status-done-text"
      : tone === "progress"
        ? "text-status-progress-text"
        : "text-ink-subtle";
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted ${toneClass}`}>
        <Icon name={icon} />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-ink-subtle">{label}</p>
      </div>
    </div>
  );
}
