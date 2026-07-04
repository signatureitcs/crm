import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";
import { ProjectTabs } from "@/components/project-tabs";
import type { Country, Project } from "@/lib/types";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.projectId)
    .single();

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

  return (
    <div>
      <div className="border-b border-border bg-surface px-6 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {country && (
              <Link
                href={`/dashboard/${country.id}`}
                className="text-sm text-ink-subtle hover:text-primary"
              >
                {country.name}
              </Link>
            )}
            <Icon name="chevron_right" size={14} className="text-ink-subtle" />
            <span className="text-base font-semibold">{p.name}</span>
            <span className="badge bg-status-progress-bg text-status-progress-text capitalize">
              {p.current_phase ?? "active"}
            </span>
          </div>
          <Link
            href={`/dashboard/project/${p.id}/kanban`}
            className="btn-secondary"
          >
            <Icon name="view_kanban" size={18} />
            Open kanban
          </Link>
        </div>
        <ProjectTabs projectId={p.id} isManager={profile.role === "manager"} />
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
