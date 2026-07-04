import { Icon } from "@/components/icon";
import { formatDate } from "@/lib/format";
import type { Handoff } from "@/lib/types";

export function HandoffPanel({
  handoff,
  assigneeName,
}: {
  handoff: Handoff;
  assigneeName?: string | null;
}) {
  const snapshot = handoff.checklist_snapshot ?? [];
  return (
    <div className="card border-status-done-text/20 bg-status-done-bg/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            name="task_alt"
            filled
            size={18}
            className="text-status-done-text"
          />
          <h4 className="text-sm font-semibold text-status-done-text">
            Assigned to SEO{assigneeName ? ` · ${assigneeName}` : ""}
          </h4>
        </div>
        <span className="text-xs text-ink-subtle">
          {formatDate(handoff.created_at)}
        </span>
      </div>
      <ul className="space-y-2">
        {snapshot.map((item, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-center gap-2 text-ink-muted">
              <Icon
                name="check_circle"
                filled
                size={16}
                className="text-status-done-text"
              />
              <span className="font-medium">{item.label}</span>
            </div>
            {item.note && (
              <p className="ml-6 mt-0.5 text-ink-muted">{item.note}</p>
            )}
          </li>
        ))}
      </ul>

      {handoff.dev_summary && (
        <div className="mt-3 border-t border-status-done-text/20 pt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Completion summary
          </p>
          <p className="whitespace-pre-wrap text-sm text-ink-muted">
            {handoff.dev_summary}
          </p>
        </div>
      )}
    </div>
  );
}
