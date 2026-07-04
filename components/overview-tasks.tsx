"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { clsx } from "@/lib/clsx";
import { relativeDue, formatDate } from "@/lib/format";
import { setTaskStatus } from "@/app/dashboard/project/actions";
import type { Task, TaskStatus } from "@/lib/types";

export type OverviewTask = Task & {
  projects: {
    name: string;
    project_type: string;
    country_id: string | null;
  } | null;
};

const GROUPS: { status: TaskStatus; title: string; dot: string }[] = [
  { status: "processing", title: "In progress", dot: "bg-status-progress-text" },
  { status: "todo", title: "To do", dot: "bg-ink-subtle" },
  { status: "completed", title: "Completed", dot: "bg-status-done-text" },
];

export function OverviewTasks({ tasks }: { tasks: OverviewTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <Icon name="task_alt" size={32} className="mb-2 text-ink-subtle" />
        <p className="text-sm text-ink-subtle">
          You have no tasks assigned right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const rows = tasks.filter((t) => t.status === g.status);
        if (rows.length === 0) return null;
        return (
          <section key={g.status}>
            <div className="mb-2 flex items-center gap-2">
              <span className={clsx("h-2 w-2 rounded-full", g.dot)} />
              <h3 className="text-sm font-semibold">{g.title}</h3>
              <span className="text-xs text-ink-subtle">({rows.length})</span>
            </div>
            <div className="card divide-y divide-border">
              {rows.map((t) => (
                <Row key={t.id} task={t} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Row({ task }: { task: OverviewTask }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const due = relativeDue(task.due_date);
  const done = task.status === "completed";
  const projectHref =
    task.projects?.project_type === "gmb"
      ? `/dashboard/gmb/${task.project_id}`
      : `/dashboard/project/${task.project_id}`;

  function changeStatus(status: TaskStatus) {
    startTransition(async () => {
      await setTaskStatus(task.id, task.project_id, status);
      router.refresh();
    });
  }

  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-4 px-4 py-3",
        pending && "opacity-60",
      )}
    >
      <div className="min-w-0">
        <p
          className={clsx(
            "truncate text-sm font-medium",
            done && "text-ink-subtle line-through",
          )}
        >
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-subtle">
          <Link href={projectHref} className="hover:text-primary">
            {task.projects?.name ?? "Project"}
          </Link>
          {task.due_date && (
            <>
              <span>·</span>
              <span
                className={clsx(
                  "flex items-center gap-1",
                  !done && due.overdue && "font-medium text-status-error-text",
                )}
              >
                <Icon name="calendar_today" size={12} />
                {formatDate(task.due_date)}
                {!done && ` (${due.label})`}
              </span>
            </>
          )}
        </div>
      </div>
      <select
        value={task.status}
        disabled={pending}
        onChange={(e) => changeStatus(e.target.value as TaskStatus)}
        className="h-8 shrink-0 rounded-lg border border-border bg-surface px-2 text-xs font-medium outline-none focus:border-primary"
      >
        <option value="todo">To do</option>
        <option value="processing">In progress</option>
        <option value="completed">Completed</option>
      </select>
    </div>
  );
}
