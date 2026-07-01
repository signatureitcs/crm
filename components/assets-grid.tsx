"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";
import { addAsset, deleteAsset } from "@/app/dashboard/project/actions";
import type { Asset } from "@/lib/types";

type AssetView = Asset & { publicUrl: string; uploaderName: string | null };

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

export function AssetsGrid({
  projectId,
  assets,
  canEdit,
}: {
  projectId: string;
  assets: AssetView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${projectId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("project-assets")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        await addAsset(projectId, path);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDelete(a: AssetView) {
    startTransition(async () => {
      await deleteAsset(a.id, projectId, a.file_url);
      router.refresh();
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-text">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {canEdit && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-ink-subtle transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Icon
              name={uploading ? "progress_activity" : "upload_file"}
              className={uploading ? "animate-spin" : ""}
            />
            <span className="mt-2 text-sm font-medium">
              {uploading ? "Uploading…" : "Upload asset"}
            </span>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </button>
        )}

        {assets.map((a) => {
          const name = a.file_url.split("/").pop() ?? a.file_url;
          const isImage = IMAGE_EXT.test(name);
          return (
            <div
              key={a.id}
              className="group overflow-hidden rounded-lg border border-border bg-surface"
            >
              <div className="flex h-32 items-center justify-center bg-surface-subtle">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.publicUrl}
                    alt={name}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <Icon name="description" size={40} className="text-ink-subtle" />
                )}
              </div>
              <div className="border-t border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium" title={name}>
                    {displayName(name)}
                  </p>
                  {canEdit && (
                    <button
                      onClick={() => onDelete(a)}
                      disabled={pending}
                      className="shrink-0 text-ink-subtle opacity-0 transition-opacity hover:text-status-error-text group-hover:opacity-100"
                      aria-label="Delete asset"
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  )}
                </div>
                {a.uploaderName && (
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    Uploaded by {a.uploaderName}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {assets.length === 0 && !canEdit && (
          <p className="col-span-full py-10 text-center text-sm text-ink-subtle">
            No assets uploaded yet.
          </p>
        )}
      </div>
    </div>
  );
}

// Strip the leading "<timestamp>_" prefix for display.
function displayName(name: string) {
  return name.replace(/^\d+_/, "");
}
