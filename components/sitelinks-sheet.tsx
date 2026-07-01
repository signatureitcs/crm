"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import {
  addSitelinkRow,
  updateSitelinkCell,
  deleteSitelinkRow,
} from "@/app/dashboard/project/actions";
import type { SitelinkRow } from "@/lib/types";

type Column = "page_url" | "sitelink_1" | "sitelink_2" | "sitelink_3";

const COLUMNS: { key: Column; label: string }[] = [
  { key: "page_url", label: "Page URL" },
  { key: "sitelink_1", label: "Sitelink 1" },
  { key: "sitelink_2", label: "Sitelink 2" },
  { key: "sitelink_3", label: "Sitelink 3" },
];

export function SitelinksSheet({
  projectId,
  rows,
  canEdit,
}: {
  projectId: string;
  rows: SitelinkRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function onCellBlur(
    row: SitelinkRow,
    column: Column,
    value: string,
  ) {
    if ((row[column] ?? "") === value) return;
    startTransition(async () => {
      await updateSitelinkCell(row.id, column, value);
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

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-surface-muted">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="border-b border-r border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
                >
                  {c.label}
                </th>
              ))}
              <th className="w-10 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="group hover:bg-surface-subtle">
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className="border-b border-r border-border px-2"
                  >
                    <input
                      defaultValue={row[c.key] ?? ""}
                      disabled={!canEdit}
                      onBlur={(e) => onCellBlur(row, c.key, e.target.value)}
                      placeholder={c.key === "page_url" ? "/page" : "—"}
                      className="w-full bg-transparent px-2 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:cursor-default"
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
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-ink-subtle"
                >
                  No rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        {canEdit ? (
          <button
            onClick={onAddRow}
            disabled={pending}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Icon name="add" size={16} />
            Add new page row
          </button>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1 text-xs text-ink-subtle">
          {pending ? (
            <>
              <Icon name="sync" size={14} className="animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <Icon
                name="check_circle"
                size={14}
                filled
                className="text-status-done-text"
              />
              Saved
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
