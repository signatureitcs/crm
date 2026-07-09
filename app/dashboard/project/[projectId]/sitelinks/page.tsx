import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { SitelinksSheet } from "@/components/sitelinks-sheet";
import type { Project, ProjectMember, SitelinkRow } from "@/lib/types";

const DEFAULT_COLUMNS = ["Page URL", "Sitelink 1", "Sitelink 2", "Sitelink 3"];

export default async function SitelinksPage({
  params,
}: {
  params: { projectId: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();
  const projectId = params.projectId;

  const [{ data: project }, { data: rows }, { data: members }] =
    await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase
        .from("sitelinks_rows")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order"),
      supabase
        .from("project_members")
        .select("profile_id")
        .eq("project_id", projectId),
    ]);

  const p = project as Project;
  const memberIds = new Set(
    ((members as ProjectMember[] | null) ?? []).map((m) => m.profile_id),
  );
  const canEdit =
    profile.role === "manager" ||
    memberIds.has(profile.id) ||
    [p.developer_id, p.designer_id, p.seo_id].includes(profile.id);

  const columns =
    p.sitelink_columns && p.sitelink_columns.length
      ? p.sitelink_columns
      : DEFAULT_COLUMNS;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Sitelinks sheet</h2>
        <p className="text-sm text-ink-muted">
          Columns come from your data — import a CSV to set the headers. Changes
          save automatically.
        </p>
      </div>
      <SitelinksSheet
        projectId={projectId}
        columns={columns}
        rows={(rows as SitelinkRow[]) ?? []}
        canEdit={canEdit}
      />
    </div>
  );
}
