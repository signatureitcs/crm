import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { SitelinksSheet } from "@/components/sitelinks-sheet";
import type { Project, SitelinkRow } from "@/lib/types";

export default async function SitelinksPage({
  params,
}: {
  params: { projectId: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const projectId = params.projectId;

  const [{ data: project }, { data: rows }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase
      .from("sitelinks_rows")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order"),
  ]);

  const p = project as Project;
  const canEdit =
    profile.role === "manager" ||
    [p.developer_id, p.designer_id, p.seo_id].includes(profile.id);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Sitelinks sheet</h2>
        <p className="text-sm text-ink-muted">
          Page URLs and their sitelinks. Changes save automatically.
        </p>
      </div>
      <SitelinksSheet
        projectId={projectId}
        rows={(rows as SitelinkRow[]) ?? []}
        canEdit={canEdit}
      />
    </div>
  );
}
