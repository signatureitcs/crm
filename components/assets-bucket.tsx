"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { formatDate } from "@/lib/format";

export type BucketAsset = {
  id: string;
  project_id: string;
  file_url: string;
  created_at: string;
  publicUrl: string;
  projects: { name: string } | null;
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

export function AssetsBucket({
  assets,
  projects,
}: {
  assets: BucketAsset[];
  projects: { id: string; name: string }[];
}) {
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (projectId && a.project_id !== projectId) return false;
      if (!q) return true;
      const name = fileName(a.file_url).toLowerCase();
      const proj = (a.projects?.name ?? "").toLowerCase();
      return name.includes(q) || proj.includes(q);
    });
  }, [assets, projectId, query]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="input max-w-[220px]"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">All projects / sites</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="relative max-w-[260px] flex-1">
          <Icon
            name="search"
            size={18}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            className="input pl-8"
            placeholder="Search file or project…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="text-sm text-ink-subtle">{filtered.length} files</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card py-16 text-center text-sm text-ink-subtle">
          No assets match.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((a) => {
            const name = fileName(a.file_url);
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
                  <p className="truncate text-xs font-medium" title={name}>
                    {displayName(name)}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-ink-subtle">
                    {a.projects?.name ?? "—"} · {formatDate(a.created_at)}
                  </p>
                  <a
                    href={a.publicUrl}
                    download={displayName(name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Icon name="download" size={14} />
                    Download
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fileName(path: string) {
  return path.split("/").pop() ?? path;
}
function displayName(name: string) {
  return name.replace(/^\d+_/, "");
}
