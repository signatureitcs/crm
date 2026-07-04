import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AssetsBucket, type BucketAsset } from "@/components/assets-bucket";

export default async function AssetsBucketPage() {
  await requireProfile();
  const supabase = createClient();

  const [{ data: assets }, { data: projects }] = await Promise.all([
    supabase
      .from("assets")
      .select("*, projects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const list: BucketAsset[] = ((assets as
    | (BucketAsset & { file_url: string })[]
    | null) ?? []).map((a) => ({
    ...a,
    publicUrl: supabase.storage
      .from("project-assets")
      .getPublicUrl(a.file_url).data.publicUrl,
  }));

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Assets bucket</h2>
        <p className="text-sm text-ink-muted">
          Every asset across the projects you can access. Filter by project and
          download.
        </p>
      </div>
      <AssetsBucket
        assets={list}
        projects={(projects as { id: string; name: string }[]) ?? []}
      />
    </div>
  );
}
