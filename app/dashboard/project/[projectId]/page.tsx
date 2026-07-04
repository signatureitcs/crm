import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";
import { PhaseCard } from "@/components/phase-card";
import { AssignToSeo } from "@/components/assign-to-seo";
import { HandoffPanel } from "@/components/handoff-panel";
import { SeoLog } from "@/components/seo-log";
import { QaReviewPanel } from "@/components/qa-review-panel";
import {
  ASSIGNABLE_ROLES,
  type ChecklistCompletion,
  type ChecklistTemplate,
  type Handoff,
  type Phase,
  type Profile,
  type Project,
  type ProjectMember,
  type SeoDailyLog,
  type Task,
} from "@/lib/types";

const PHASE_ORDER = ["design", "development", "seo"] as const;

export default async function WorkspacePage({
  params,
}: {
  params: { projectId: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const projectId = params.projectId;

  const [
    { data: project },
    { data: phases },
    { data: tasks },
    { data: profiles },
    { data: templates },
    { data: completions },
    { data: handoffs },
    { data: seoLogs },
    { data: memberRows },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("phases").select("*").eq("project_id", projectId),
    supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at"),
    supabase.from("profiles").select("*").order("full_name"),
    supabase
      .from("checklist_templates")
      .select("*")
      .eq("role", "developer")
      .order("sort_order"),
    supabase
      .from("checklist_completions")
      .select("*")
      .eq("project_id", projectId),
    supabase
      .from("handoffs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("seo_daily_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_members")
      .select("profile_id")
      .eq("project_id", projectId),
  ]);

  const p = project as Project;
  const phaseList = (phases as Phase[]) ?? [];
  const taskList = (tasks as Task[]) ?? [];
  const people = (profiles as Profile[]) ?? [];
  const devTemplates = (templates as ChecklistTemplate[]) ?? [];
  const completionList = (completions as ChecklistCompletion[]) ?? [];
  const handoff = ((handoffs as Handoff[]) ?? [])[0] ?? null;
  const logs = (seoLogs as SeoDailyLog[]) ?? [];

  const profilesById: Record<string, Profile> = {};
  people.forEach((pr) => (profilesById[pr.id] = pr));

  const isManager = profile.role === "manager";
  const isQa = profile.role === "qa";

  // Project team = explicit members + the phase leads. Task assignees are
  // restricted to team members whose role the current user may assign to.
  const memberIds = new Set<string>([
    ...(((memberRows as ProjectMember[] | null) ?? []).map((m) => m.profile_id)),
    ...([p.developer_id, p.designer_id, p.seo_id].filter(Boolean) as string[]),
  ]);
  const ownsProject = memberIds.has(profile.id);
  const memberProfiles = people.filter((pr) => memberIds.has(pr.id));
  const allowedRoles = ASSIGNABLE_ROLES[profile.role];
  const assignable = memberProfiles.filter((pr) =>
    allowedRoles.includes(pr.role),
  );

  const phasesByName = new Map(phaseList.map((ph) => [ph.phase_name, ph]));
  const devPhase = phasesByName.get("development");

  const counts = {
    completed: taskList.filter((t) => t.status === "completed").length,
    inProgress: taskList.filter((t) => t.status === "processing").length,
    total: taskList.length,
  };

  // Developer checklist progress for the handoff modal.
  const completionByTemplate = new Map(
    completionList.map((c) => [c.template_id, c]),
  );
  const checklistItems = devTemplates.map((t) => ({
    template: t,
    completion: completionByTemplate.get(t.id) ?? null,
  }));
  const allChecked =
    devTemplates.length > 0 &&
    checklistItems.every((i) => i.completion?.checked);

  const seoPeople = people.filter((pr) => pr.role === "seo");
  const canHandoff =
    !handoff &&
    (isManager || p.developer_id === profile.id) &&
    p.current_phase !== "seo";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">Project phases</h2>
          <p className="text-sm text-ink-muted">
            Manage the lifecycle of {p.name}.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Stat label="Completed" value={counts.completed} icon="check_circle" />
          <Stat label="In progress" value={counts.inProgress} icon="sync" />
          <Stat label="Total tasks" value={counts.total} icon="checklist" />
        </div>
      </div>

      {/* QA review — visible to all; actionable by QA */}
      {(isQa || (p.qa_status && p.qa_status !== "pending")) && (
        <QaReviewPanel
          projectId={p.id}
          status={p.qa_status}
          note={p.qa_note}
          reviewerName={
            p.qa_reviewer_id ? profilesById[p.qa_reviewer_id]?.full_name ?? null : null
          }
          isQa={isQa}
        />
      )}

      {/* Phase cards */}
      {PHASE_ORDER.map((name) => {
        const phase = phasesByName.get(name);
        if (!phase) return null;
        const phaseTasks = taskList.filter((t) => t.phase_id === phase.id);
        const canEdit =
          isManager || phase.assigned_to === profile.id || ownsProject;
        const isDev = name === "development";

        return (
          <div key={phase.id}>
            <PhaseCard
              phase={phase}
              tasks={phaseTasks}
              profilesById={profilesById}
              assignableTo={assignable}
              canEdit={canEdit}
              canAddTask={canEdit || isQa}
              active={p.current_phase === name}
              footer={
                isDev && canHandoff ? (
                  <AssignToSeo
                    projectId={p.id}
                    phaseId={devPhase?.id ?? phase.id}
                    seoPhaseId={phasesByName.get("seo")?.id ?? ""}
                    seoPeople={seoPeople}
                    items={checklistItems}
                    allChecked={allChecked}
                    canEdit={isManager || p.developer_id === profile.id}
                  />
                ) : null
              }
            />
            {isDev && handoff && (
              <div className="mt-3">
                <HandoffPanel
                  handoff={handoff}
                  assigneeName={
                    handoff.to_profile_id
                      ? profilesById[handoff.to_profile_id]?.full_name
                      : null
                  }
                />
              </div>
            )}
          </div>
        );
      })}

      {/* SEO daily log */}
      <SeoLog
        projectId={p.id}
        logs={logs}
        authorsById={profilesById}
        canEdit={isManager || p.seo_id === profile.id}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="card flex items-center gap-3 px-4 py-2">
      <Icon name={icon} size={20} className="text-primary" />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-xs text-ink-subtle">{label}</p>
      </div>
    </div>
  );
}
