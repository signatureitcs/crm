import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { SitelinksBucket, type BucketSitelink } from "@/components/sitelinks-bucket";

export default async function SitelinksBucketPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  await requireProfile();
  const supabase = createClient();

  const [{ data: rows }, { data: projects }] = await Promise.all([
    supabase
      .from("sitelinks_rows")
      .select("*, projects(name)")
      .order("project_id")
      .order("sort_order"),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Sitelinks bucket</h2>
        <p className="text-sm text-ink-muted">
          All sitelinks across your projects. Filter by project, import or export
          CSV.
        </p>
      </div>
      <SitelinksBucket
        rows={(rows as BucketSitelink[]) ?? []}
        projects={(projects as { id: string; name: string }[]) ?? []}
        initialProject={searchParams.project ?? ""}
      />
    </div>
  );
}
