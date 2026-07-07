import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";
import { GmbChecklist } from "@/components/gmb-checklist";
import type { Country, GmbTask, Project } from "@/lib/types";

export default async function GmbPage({
  params,
}: {
  params: { projectId: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const projectId = params.projectId;

  const [{ data: project }, { data: gmbTasks }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase
      .from("gmb_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("task_type"),
  ]);

  if (!project) notFound();
  const p = project as Project;

  let country: Country | null = null;
  if (p.country_id) {
    const { data } = await supabase
      .from("countries")
      .select("*")
      .eq("id", p.country_id)
      .single();
    country = (data as Country) ?? null;
  }

  const tasks = (gmbTasks as GmbTask[]) ?? [];
  const isManager = profile.role === "manager";
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-ink-subtle">
          {country && (
            <>
              <Link
                href={`/dashboard/${country.id}`}
                className="hover:text-primary"
              >
                {country.name}
              </Link>
              <Icon name="chevron_right" size={14} />
            </>
          )}
          <span className="font-semibold text-primary">{p.name}</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <p className="text-sm text-ink-muted">
              GMB &amp; local-listing management.
            </p>
          </div>
          <span className="badge bg-status-done-bg text-status-done-text">
            {doneCount}/{tasks.length} done
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-semibold">Task checklist</h3>
            </div>
            <GmbChecklist
              projectId={projectId}
              tasks={tasks}
              canEdit={isManager}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="insights" size={18} className="text-primary" />
              <h3 className="font-semibold">30-day insights</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Insight label="Search views" value="—" />
              <Insight label="Map actions" value="—" />
            </div>
            <p className="mt-3 text-xs text-ink-subtle">
              Connect Google Business Profile to populate insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-subtle p-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-subtle">
        {label}
      </p>
      <p className="text-lg font-bold text-ink-subtle">{value}</p>
    </div>
  );
}
