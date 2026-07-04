"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { importSitelinkRows } from "@/app/dashboard/project/actions";

export type BucketSitelink = {
  id: string;
  project_id: string;
  page_url: string | null;
  sitelink_1: string | null;
  sitelink_2: string | null;
  sitelink_3: string | null;
  sort_order: number;
  projects: { name: string } | null;
};

export function SitelinksBucket({
  rows,
  projects,
}: {
  rows: BucketSitelink[];
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filterProject, setFilterProject] = useState("");
  const [importProject, setImportProject] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      filterProject
        ? rows.filter((r) => r.project_id === filterProject)
        : rows,
    [rows, filterProject],
  );

  function onExport() {
    const header = ["page_url", "sitelink_1", "sitelink_2", "sitelink_3", "project"];
    const body = filtered.map((r) => [
      r.page_url ?? "",
      r.sitelink_1 ?? "",
      r.sitelink_2 ?? "",
      r.sitelink_3 ?? "",
      r.projects?.name ?? "",
    ]);
    const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sitelinks.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(file: File | null) {
    setErr(null);
    setMsg(null);
    if (!file) return;
    if (!importProject) {
      setErr("Choose a project to import into first.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setErr("No rows found in the file.");
      return;
    }
    // Drop a header row if present.
    const first = parsed[0]?.[0]?.trim().toLowerCase();
    const dataRows = first === "page_url" ? parsed.slice(1) : parsed;
    const mapped = dataRows
      .filter((cols) => cols.some((c) => c.trim()))
      .map((cols) => ({
        page_url: cols[0] ?? "",
        sitelink_1: cols[1] ?? "",
        sitelink_2: cols[2] ?? "",
        sitelink_3: cols[3] ?? "",
      }));

    startTransition(async () => {
      try {
        const res = await importSitelinkRows(importProject, mapped);
        setMsg(`Imported ${res.inserted} rows.`);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Import failed.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input max-w-[220px]"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-ink-subtle">{filtered.length} rows</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onExport} className="btn-secondary">
            <Icon name="download" size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Import bar */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <Icon name="upload_file" size={18} className="text-primary" />
        <span className="text-sm font-medium">Import CSV into</span>
        <select
          className="input max-w-[200px]"
          value={importProject}
          onChange={(e) => setImportProject(e.target.value)}
        >
          <option value="">Select project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Importing…" : "Choose file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onImportFile(e.target.files?.[0] ?? null)}
        />
        <span className="text-xs text-ink-subtle">
          Columns: page_url, sitelink_1, sitelink_2, sitelink_3
        </span>
        {msg && <span className="text-xs text-status-done-text">{msg}</span>}
        {err && <span className="text-xs text-status-error-text">{err}</span>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-surface-muted">
            <tr>
              {["Project", "Page URL", "Sitelink 1", "Sitelink 2", "Sitelink 3"].map(
                (h) => (
                  <th
                    key={h}
                    className="border-b border-r border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-surface-subtle">
                <td className="border-r border-border px-3 py-2 font-medium">
                  {r.projects?.name ?? "—"}
                </td>
                <td className="border-r border-border px-3 py-2">{r.page_url}</td>
                <td className="border-r border-border px-3 py-2">{r.sitelink_1}</td>
                <td className="border-r border-border px-3 py-2">{r.sitelink_2}</td>
                <td className="px-3 py-2">{r.sitelink_3}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink-subtle">
                  No sitelinks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function csvCell(value: string) {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Minimal RFC-4180-ish CSV parser (handles quotes, commas, CRLF).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
