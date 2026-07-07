import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";
import { AddProjectButton } from "@/components/add-project-button";
import { hasRole, type Country, type Profile, type Project } from "@/lib/types";

export default async function CountryPage({
  params,
}: {
  params: { countryId: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();

  const [{ data: country }, { data: projects }, { data: profiles }] =
    await Promise.all([
      supabase.from("countries").select("*").eq("id", params.countryId).single(),
      supabase
        .from("projects")
        .select("*")
        .eq("country_id", params.countryId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("full_name"),
    ]);

  if (!country) notFound();

  const projectList = (projects as Project[]) ?? [];
  const people = (profiles as Profile[]) ?? [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-ink-subtle">
            <span>Countries</span>
            <Icon name="chevron_right" size={14} />
            <span className="font-semibold text-primary">
              {(country as Country).name}
            </span>
          </div>
          <h2 className="text-xl font-semibold">{(country as Country).name}</h2>
          <p className="text-sm text-ink-muted">
            {projectList.length} project{projectList.length === 1 ? "" : "s"}
          </p>
        </div>
        {profile.role !== "super_admin" && (
          <AddProjectButton
            countryId={params.countryId}
            developers={people.filter((p) => hasRole(p, "developer"))}
            designers={people.filter((p) => hasRole(p, "designer"))}
            seos={people.filter((p) => hasRole(p, "seo"))}
          />
        )}
      </div>

      {projectList.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon name="dns" />
          </div>
          <h3 className="font-semibold">No projects yet</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {profile.role === "super_admin"
              ? "No projects have been added to this country yet."
              : "Add a project to start tracking phases and tasks."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectList.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const href =
    project.project_type === "gmb"
      ? `/dashboard/gmb/${project.id}`
      : `/dashboard/project/${project.id}`;
  return (
    <Link
      href={href}
      className="card group p-4 transition-colors hover:border-primary"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-primary">
          <Icon name={project.project_type === "gmb" ? "location_on" : "dns"} />
        </div>
        <span className="badge bg-surface-muted text-ink-muted capitalize">
          {project.project_type === "gmb" ? "GMB" : "Website"}
        </span>
      </div>
      <h3 className="font-semibold group-hover:text-primary">{project.name}</h3>
      <p className="mt-0.5 text-sm capitalize text-ink-muted">
        {project.current_phase
          ? `${project.current_phase} phase`
          : "Local listing"}
      </p>
    </Link>
  );
}
