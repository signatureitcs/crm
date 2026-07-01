"use client";

import { useTransition } from "react";
import { Icon } from "@/components/icon";
import { clsx } from "@/lib/clsx";
import { relativeDue } from "@/lib/format";
import { setTaskStatus, deleteTask } from "@/app/dashboard/project/actions";
import type { Task } from "@/lib/types";

export function TaskRow({
  task,
  assigneeName,
  canEdit,
}: {
  task: Task;
  assigneeName?: string | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const done = task.status === "completed";
  const due = relativeDue(task.due_date);

  function toggle() {
    if (!canEdit) return;
    startTransition(() =>
      setTaskStatus(
        task.id,
        task.project_id,
        done ? "todo" : "completed",
      ),
    );
  }

  function remove() {
    startTransition(() => deleteTask(task.id, task.project_id));
  }

  return (
    <div
      className={clsx(
        "group flex items-center justify-between rounded-lg border border-transparent px-3 py-2 hover:bg-surface-subtle",
        pending && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={toggle}
          disabled={!canEdit || pending}
          className={clsx(
            "flex h-5 w-5 items-center justify-center rounded border",
            done
              ? "border-primary bg-primary text-on-primary"
              : "border-ink-subtle text-transparent",
            canEdit ? "cursor-pointer" : "cursor-default",
          )}
          aria-label={done ? "Mark as to do" : "Mark as completed"}
        >
          <Icon name="check" size={14} />
        </button>
        <span
          className={clsx(
            "truncate text-sm",
            done ? "text-ink-subtle line-through" : "text-ink",
          )}
        >
          {task.title}
        </span>
        {assigneeName && (
          <span className="hidden shrink-0 text-xs text-ink-subtle sm:inline">
            · {assigneeName}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!done && task.due_date && (
          <span
            className={clsx(
              "text-xs font-medium",
              due.overdue ? "text-status-error-text" : "text-ink-subtle",
            )}
          >
            {due.label}
          </span>
        )}
        {done && (
          <Icon name="check_circle" filled size={16} className="text-status-done-text" />
        )}
        {canEdit && (
          <button
            onClick={remove}
            disabled={pending}
            className="text-ink-subtle opacity-0 transition-opacity hover:text-status-error-text group-hover:opacity-100"
            aria-label="Delete task"
          >
            <Icon name="delete" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
