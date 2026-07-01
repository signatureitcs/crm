import { Icon } from "@/components/icon";
import { TaskRow } from "@/components/task-row";
import { AddTaskForm } from "@/components/add-task-form";
import { phaseBadge } from "@/lib/format";
import type { Phase, Profile, Task } from "@/lib/types";

const PHASE_META: Record<
  string,
  { title: string; icon: string; blurb: string }
> = {
  design: {
    title: "Design phase",
    icon: "palette",
    blurb: "Branding, UI/UX, and prototyping.",
  },
  development: {
    title: "Development phase",
    icon: "code",
    blurb: "Converting designs into a responsive codebase.",
  },
  seo: {
    title: "SEO phase",
    icon: "search",
    blurb: "Optimization, metadata, and local listing verification.",
  },
};

export function PhaseCard({
  phase,
  tasks,
  profilesById,
  assignableTo,
  canEdit,
  footer,
  active,
}: {
  phase: Phase;
  tasks: Task[];
  profilesById: Record<string, Profile>;
  assignableTo: Profile[];
  canEdit: boolean;
  footer?: React.ReactNode;
  active?: boolean;
}) {
  const meta = PHASE_META[phase.phase_name];
  const badge = phaseBadge(phase.status);
  const assignee = phase.assigned_to ? profilesById[phase.assigned_to] : null;
  const locked = phase.status === "locked";

  return (
    <section
      className={`card overflow-hidden ${active ? "border-2 border-primary" : ""}`}
    >
      <div className="flex items-start gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
          <Icon name={meta.icon} filled />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-base font-semibold">{meta.title}</h3>
            <span className={`badge ${badge.className}`}>{badge.label}</span>
          </div>
          <p className="mb-4 text-sm text-ink-muted">{meta.blurb}</p>

          {locked ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-subtle py-8 text-center">
              <Icon name="lock" className="mb-1 text-ink-subtle" />
              <p className="text-sm text-ink-subtle">
                Locked until handed off from development
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1 border-t border-border pt-3">
                {tasks.length === 0 && (
                  <p className="px-3 py-2 text-sm text-ink-subtle">
                    No tasks yet.
                  </p>
                )}
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    assigneeName={
                      task.assigned_to
                        ? profilesById[task.assigned_to]?.full_name
                        : null
                    }
                    canEdit={canEdit}
                  />
                ))}
              </div>

              {canEdit && (
                <div className="mt-1">
                  <AddTaskForm
                    projectId={phase.project_id}
                    phaseId={phase.id}
                    assignableTo={assignableTo}
                    defaultAssignee={phase.assigned_to}
                  />
                </div>
              )}
            </>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Icon name="person" size={18} />
              {assignee ? `Assigned to ${assignee.full_name}` : "Unassigned"}
            </div>
            {footer}
          </div>
        </div>
      </div>
    </section>
  );
}
