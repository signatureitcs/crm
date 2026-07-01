"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Icon } from "@/components/icon";
import { clsx } from "@/lib/clsx";
import { formatDate, relativeDue } from "@/lib/format";
import { setTaskStatus } from "@/app/dashboard/project/actions";
import type { Profile, Task, TaskStatus } from "@/lib/types";

const COLUMNS: { id: TaskStatus; title: string; dot: string }[] = [
  { id: "todo", title: "To do", dot: "bg-ink-subtle" },
  { id: "processing", title: "Processing", dot: "bg-primary" },
  { id: "completed", title: "Completed", dot: "bg-status-done-text" },
];

export function KanbanBoard({
  projectId,
  initialTasks,
  profilesById,
  showAssignee,
}: {
  projectId: string;
  initialTasks: Task[];
  profilesById: Record<string, Profile>;
  showAssignee: boolean;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update, then persist.
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );
    setTaskStatus(taskId, projectId, newStatus).catch(() => {
      // Revert on failure.
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: task.status } : t,
        ),
      );
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            title={col.title}
            dot={col.dot}
            tasks={tasks.filter((t) => t.status === col.id)}
            profilesById={profilesById}
            showAssignee={showAssignee}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <Card
            task={activeTask}
            profilesById={profilesById}
            showAssignee={showAssignee}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  id,
  title,
  dot,
  tasks,
  profilesById,
  showAssignee,
}: {
  id: TaskStatus;
  title: string;
  dot: string;
  tasks: Task[];
  profilesById: Record<string, Profile>;
  showAssignee: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex h-full min-h-[60vh] flex-col rounded-xl border bg-surface-muted/50 transition-colors",
        isOver ? "border-primary bg-primary-soft/40" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 p-4">
        <span className={clsx("h-2 w-2 rounded-full", dot)} />
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          {title}
        </h3>
        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-ink-muted">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 px-4 pb-4">
        {tasks.length === 0 && (
          <p className="px-1 py-2 text-xs text-ink-subtle">No tasks.</p>
        )}
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            profilesById={profilesById}
            showAssignee={showAssignee}
          />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({
  task,
  profilesById,
  showAssignee,
}: {
  task: Task;
  profilesById: Record<string, Profile>;
  showAssignee: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={clsx("touch-none", isDragging && "opacity-30")}
    >
      <Card
        task={task}
        profilesById={profilesById}
        showAssignee={showAssignee}
      />
    </div>
  );
}

function Card({
  task,
  profilesById,
  showAssignee,
  overlay,
}: {
  task: Task;
  profilesById: Record<string, Profile>;
  showAssignee: boolean;
  overlay?: boolean;
}) {
  const done = task.status === "completed";
  const due = relativeDue(task.due_date);
  const assignee = task.assigned_to ? profilesById[task.assigned_to] : null;
  return (
    <div
      className={clsx(
        "cursor-grab rounded-lg border border-border bg-surface p-3 active:cursor-grabbing",
        overlay && "shadow-lg",
      )}
    >
      <p
        className={clsx(
          "mb-2 text-sm font-medium",
          done ? "text-ink-subtle line-through" : "text-ink",
        )}
      >
        {task.title}
      </p>
      <div className="flex items-center justify-between">
        <span
          className={clsx(
            "flex items-center gap-1 text-xs",
            done
              ? "text-status-done-text"
              : due.overdue
                ? "text-status-error-text"
                : "text-ink-subtle",
          )}
        >
          <Icon
            name={done ? "check_circle" : "calendar_today"}
            size={14}
            filled={done}
          />
          {done ? "Completed" : task.due_date ? formatDate(task.due_date) : "No date"}
        </span>
        {showAssignee && assignee && (
          <span className="text-xs text-ink-subtle">{assignee.full_name}</span>
        )}
      </div>
    </div>
  );
}
