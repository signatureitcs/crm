import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AssetsGrid } from "@/components/assets-grid";
import type { Asset, Profile, Project } from "@/lib/types";

export default async function AssetsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const projectId = params.projectId;

  const [{ data: project }, { data: assets }, { data: profiles }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("assets")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, role, created_at"),
    ]);

  const p = project as Project;
  const profilesById: Record<string, Profile> = {};
  (profiles as Profile[] | null)?.forEach((pr) => (profilesById[pr.id] = pr));

  const assetList = ((assets as Asset[]) ?? []).map((a) => ({
    ...a,
    publicUrl: supabase.storage
      .from("project-assets")
      .getPublicUrl(a.file_url).data.publicUrl,
    uploaderName: a.uploaded_by
      ? profilesById[a.uploaded_by]?.full_name ?? null
      : null,
  }));

  const canEdit =
    profile.role === "manager" ||
    [p.developer_id, p.designer_id, p.seo_id].includes(profile.id);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Assets</h2>
        <p className="text-sm text-ink-muted">
          Logos, images, and files for {p.name}.
        </p>
      </div>
      <AssetsGrid
        projectId={projectId}
        assets={assetList}
        canEdit={canEdit}
      />
    </div>
  );
}
