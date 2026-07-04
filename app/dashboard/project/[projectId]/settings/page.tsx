import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ProjectSettings } from "@/components/project-settings";
import type { Profile, Project, ProjectMember } from "@/lib/types";

export default async function ProjectSettingsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const profile = await requireProfile();
  if (profile.role !== "manager") redirect(`/dashboard/project/${params.projectId}`);

  const supabase = createClient();
  const [{ data: project }, { data: members }, { data: profiles }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", params.projectId).single(),
      supabase
        .from("project_members")
        .select("*")
        .eq("project_id", params.projectId),
      supabase.from("profiles").select("*").order("full_name"),
    ]);

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Project settings</h2>
        <p className="text-sm text-ink-muted">
          Manage the team, client details, and project lifecycle.
        </p>
      </div>
      <ProjectSettings
        project={project as Project}
        members={(members as ProjectMember[]) ?? []}
        allProfiles={(profiles as Profile[]) ?? []}
      />
    </div>
  );
}
