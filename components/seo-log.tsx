import { Icon } from "@/components/icon";
import { formatDate } from "@/lib/format";
import { addSeoLog } from "@/app/dashboard/project/actions";
import type { Profile, SeoDailyLog } from "@/lib/types";

export function SeoLog({
  projectId,
  logs,
  authorsById,
  canEdit,
}: {
  projectId: string;
  logs: SeoDailyLog[];
  authorsById: Record<string, Profile>;
  canEdit: boolean;
}) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="event_note" size={20} className="text-primary" />
        <h3 className="font-semibold">SEO daily log</h3>
      </div>

      {canEdit && (
        <form action={addSeoLog} className="mb-4 flex gap-2">
          <input type="hidden" name="project_id" value={projectId} />
          <input
            name="note"
            required
            className="input"
            placeholder="Add a daily note…"
          />
          <button type="submit" className="btn-primary shrink-0">
            Add
          </button>
        </form>
      )}

      <div className="space-y-3">
        {logs.length === 0 && (
          <p className="text-sm text-ink-subtle">No log entries yet.</p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
              {(log.author_id && authorsById[log.author_id]?.full_name?.[0]) ??
                "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{log.note}</p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {log.author_id
                  ? authorsById[log.author_id]?.full_name ?? "Unknown"
                  : "Unknown"}{" "}
                · {formatDate(log.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
