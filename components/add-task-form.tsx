"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { addTask } from "@/app/dashboard/project/actions";
import type { Profile } from "@/lib/types";

export function AddTaskForm({
  projectId,
  phaseId,
  assignableTo,
  defaultAssignee,
}: {
  projectId: string;
  phaseId: string;
  assignableTo: Profile[];
  defaultAssignee?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary hover:underline"
      >
        <Icon name="add" size={16} />
        Add task
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await addTask(fd);
        formRef.current?.reset();
        setOpen(false);
      }}
      className="space-y-2 rounded-lg border border-border bg-surface-subtle p-3"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="phase_id" value={phaseId} />
      <input
        name="title"
        required
        autoFocus
        className="input"
        placeholder="Task title"
      />
      <div className="flex gap-2">
        <select
          name="assigned_to"
          defaultValue={defaultAssignee ?? ""}
          className="input"
        >
          <option value="">Unassigned</option>
          {assignableTo.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
        <input type="date" name="due_date" className="input" />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Add task
        </button>
      </div>
    </form>
  );
}
