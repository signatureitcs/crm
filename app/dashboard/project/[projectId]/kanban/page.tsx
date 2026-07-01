import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";
import { KanbanBoard } from "@/components/kanban-board";
import type { Profile, Project, Task } from "@/lib/types";

export default async function KanbanPage({
  params,
}: {
  params: { projectId: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const projectId = params.projectId;
  const isManager = profile.role === "manager";

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  const p = project as Project;

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (!isManager) query = query.eq("assigned_to", profile.id);
  const { data: tasks } = await query;

  const profilesById: Record<string, Profile> = {};
  if (isManager) {
    const { data: profiles } = await supabase.from("profiles").select("*");
    (profiles as Profile[] | null)?.forEach((pr) => (profilesById[pr.id] = pr));
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-subtle">
            <Link
              href={`/dashboard/project/${projectId}`}
              className="hover:text-primary"
            >
              {p.name}
            </Link>
            <Icon name="chevron_right" size={14} />
            <span>Kanban</span>
          </div>
          <h2 className="text-xl font-semibold">Development kanban</h2>
          <p className="text-sm text-ink-muted">
            {isManager
              ? "All tasks on this project. Drag to update status."
              : "Your tasks on this project. Drag a card to update its status."}
          </p>
        </div>
        <Link
          href={`/dashboard/project/${projectId}`}
          className="btn-secondary"
        >
          <Icon name="arrow_back" size={18} />
          Back to workspace
        </Link>
      </div>

      <KanbanBoard
        projectId={projectId}
        initialTasks={(tasks as Task[]) ?? []}
        profilesById={profilesById}
        showAssignee={isManager}
      />
    </div>
  );
}
