"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { clsx } from "@/lib/clsx";
import { qaSetReview } from "@/app/dashboard/project/actions";

type QaStatus = "pending" | "approved" | "rejected" | null;

const STATUS_META: Record<
  "pending" | "approved" | "rejected",
  { label: string; className: string; icon: string }
> = {
  pending: {
    label: "QA pending",
    className: "bg-status-todo-bg text-status-todo-text",
    icon: "hourglass_empty",
  },
  approved: {
    label: "QA approved",
    className: "bg-status-done-bg text-status-done-text",
    icon: "verified",
  },
  rejected: {
    label: "QA needs fixes",
    className: "bg-status-error-bg text-status-error-text",
    icon: "report",
  },
};

export function QaReviewPanel({
  projectId,
  status,
  note,
  reviewerName,
  isQa,
}: {
  projectId: string;
  status: QaStatus;
  note: string | null;
  reviewerName: string | null;
  isQa: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(note ?? "");
  const meta = STATUS_META[status ?? "pending"];

  function submit(next: "approved" | "rejected") {
    startTransition(async () => {
      await qaSetReview(projectId, next, draft);
      router.refresh();
    });
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="fact_check" size={20} className="text-primary" />
          <h3 className="font-semibold">Quality assurance</h3>
        </div>
        <span className={clsx("badge", meta.className)}>
          <Icon name={meta.icon} size={14} className="mr-1" />
          {meta.label}
        </span>
      </div>

      {note && !isQa && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-subtle p-3 text-sm text-ink-muted">
          {note}
          {reviewerName && (
            <span className="mt-1 block text-xs text-ink-subtle">
              — {reviewerName}
            </span>
          )}
        </p>
      )}

      {isQa && (
        <div className="mt-3">
          <textarea
            rows={2}
            className="input h-auto py-2 text-sm"
            placeholder="Review notes (what's wrong / what to fix)…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => submit("approved")}
              disabled={pending}
              className="btn bg-status-done-bg text-status-done-text hover:opacity-90"
            >
              <Icon name="check_circle" size={18} />
              Approve
            </button>
            <button
              onClick={() => submit("rejected")}
              disabled={pending}
              className="btn bg-status-error-bg text-status-error-text hover:opacity-90"
            >
              <Icon name="report" size={18} />
              Needs fixes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
