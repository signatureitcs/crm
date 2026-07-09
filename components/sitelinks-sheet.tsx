"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { parseCsv, toCsv, downloadCsv } from "@/lib/csv";
import {
  addSitelinkRow,
  deleteSitelinkRow,
  updateSitelinkCells,
  setSitelinkColumns,
  importSitelinksDynamic,
} from "@/app/dashboard/project/actions";
import type { SitelinkRow } from "@/lib/types";

export function SitelinksSheet({
  projectId,
  columns,
  rows,
  canEdit,
}: {
  projectId: string;
  columns: string[];
  rows: SitelinkRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cellValue = (row: SitelinkRow, col: string) =>
    (row.cells && row.cells[col]) ?? "";

  function onCellBlur(row: SitelinkRow, col: string, value: string) {
    if (cellValue(row, col) === value) return;
    const nextCells: Record<string, string> = {};
    columns.forEach((c) => {
      nextCells[c] = c === col ? value : String(cellValue(row, c) ?? "");
    });
    startTransition(async () => {
      await updateSitelinkCells(row.id, nextCells);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function onAddRow() {
    const nextOrder = rows.length
      ? Math.max(...rows.map((r) => r.sort_order)) + 1
      : 0;
    startTransition(async () => {
      await addSitelinkRow(projectId, nextOrder);
      router.refresh();
    });
  }

  function onDeleteRow(rowId: string) {
    startTransition(async () => {
      await deleteSitelinkRow(rowId, projectId);
      router.refresh();
    });
  }

  function onAddColumn() {
    const name = window.prompt("New column name:");
    if (!name?.trim()) return;
    startTransition(async () => {
      await setSitelinkColumns(projectId, [...columns, name.trim()]);
      router.refresh();
    });
  }

  function onRenameColumn(index: number) {
    const name = window.prompt("Rename column:", columns[index]);
    if (name === null) return;
    const next = [...columns];
    if (name.trim()) next[index] = name.trim();
    else next.splice(index, 1); // empty name removes the column
    startTransition(async () => {
      await setSitelinkColumns(projectId, next);
      router.refresh();
    });
  }

  async function onImport(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length < 1) {
        setError("The CSV appears to be empty.");
        return;
      }
      const header = grid[0].map((h) => h.trim() || "Column");
      const dataRows = grid.slice(1).map((r) => {
        const cells: Record<string, string> = {};
        header.forEach((h, i) => (cells[h] = (r[i] ?? "").trim()));
        return cells;
      });
      startTransition(async () => {
        await importSitelinksDynamic(projectId, header, dataRows);
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onExport() {
    const data = rows.map((r) =>
      columns.map((c) => String(cellValue(r, c) ?? "")),
    );
    downloadCsv(`sitelinks-${projectId}.csv`, toCsv(columns, data));
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={pending}
                className="btn-secondary"
              >
                <Icon name="upload_file" size={16} />
                Import CSV
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onImport(e.target.files)}
              />
              <button
                onClick={onAddColumn}
                disabled={pending}
                className="btn-secondary"
              >
                <Icon name="add" size={16} />
                Add column
              </button>
            </>
          )}
          <button onClick={onExport} className="btn-secondary">
            <Icon name="download" size={16} />
            Export CSV
          </button>
        </div>
        <span className="flex items-center gap-1 text-xs text-ink-subtle">
          {pending ? (
            <>
              <Icon name="sync" size={14} className="animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <Icon name="check_circle" size={14} filled className="text-status-done-text" />
              Saved
            </>
          ) : null}
        </span>
      </div>

      {error && (
        <p className="border-b border-border bg-status-error-bg px-4 py-2 text-sm text-status-error-text">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={canEdit ? () => onRenameColumn(i) : undefined}
                  className={`whitespace-nowrap border-b border-r border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle ${
                    canEdit ? "cursor-pointer hover:text-primary" : ""
                  }`}
                  title={canEdit ? "Click to rename (blank = delete column)" : undefined}
                >
                  {col}
                </th>
              ))}
              <th className="w-10 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="group hover:bg-surface-subtle">
                {columns.map((col, i) => (
                  <td key={i} className="border-b border-r border-border px-2">
                    <input
                      defaultValue={cellValue(row, col)}
                      disabled={!canEdit}
                      onBlur={(e) => onCellBlur(row, col, e.target.value)}
                      placeholder="—"
                      className="w-full min-w-[120px] bg-transparent px-2 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:cursor-default"
                    />
                  </td>
                ))}
                <td className="border-b border-border text-center">
                  {canEdit && (
                    <button
                      onClick={() => onDeleteRow(row.id)}
                      disabled={pending}
                      className="text-ink-subtle opacity-0 hover:text-status-error-text group-hover:opacity-100"
                      aria-label="Delete row"
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-sm text-ink-subtle"
                >
                  No rows yet. Import a CSV or add a row.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="border-t border-border px-4 py-2">
          <button
            onClick={onAddRow}
            disabled={pending}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Icon name="add" size={16} />
            Add new row
          </button>
        </div>
      )}
    </div>
  );
}
