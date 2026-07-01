import type { TaskStatus, PhaseStatus, GmbTaskStatus } from "@/lib/types";

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function relativeDue(value: string | null): {
  label: string;
  overdue: boolean;
} {
  if (!value) return { label: "No due date", overdue: false };
  const due = new Date(value);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(due) - startOfDay(now)) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { label: "Due today", overdue: false };
  if (days === 1) return { label: "Due tomorrow", overdue: false };
  return { label: `Due in ${days}d`, overdue: false };
}

const TASK_BADGE: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "To do", className: "bg-status-todo-bg text-status-todo-text" },
  processing: {
    label: "Processing",
    className: "bg-status-progress-bg text-status-progress-text",
  },
  completed: {
    label: "Completed",
    className: "bg-status-done-bg text-status-done-text",
  },
};

export function taskBadge(status: TaskStatus) {
  return TASK_BADGE[status];
}

const PHASE_BADGE: Record<PhaseStatus, { label: string; className: string }> = {
  locked: { label: "Locked", className: "bg-status-todo-bg text-status-todo-text" },
  in_progress: {
    label: "In progress",
    className: "bg-status-progress-bg text-status-progress-text",
  },
  complete: {
    label: "Complete",
    className: "bg-status-done-bg text-status-done-text",
  },
};

export function phaseBadge(status: PhaseStatus) {
  return PHASE_BADGE[status];
}

const GMB_BADGE: Record<GmbTaskStatus, { label: string; className: string }> = {
  todo: { label: "To do", className: "bg-status-todo-bg text-status-todo-text" },
  in_progress: {
    label: "In progress",
    className: "bg-status-progress-bg text-status-progress-text",
  },
  done: { label: "Done", className: "bg-status-done-bg text-status-done-text" },
};

export function gmbBadge(status: GmbTaskStatus) {
  return GMB_BADGE[status];
}
