"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Dialog } from "@/components/dialog";
import { clsx } from "@/lib/clsx";
import {
  toggleChecklistItem,
  saveChecklistNote,
  handoffToSeo,
} from "@/app/dashboard/project/actions";
import type { ChecklistCompletion, ChecklistTemplate, Profile } from "@/lib/types";

type Item = { template: ChecklistTemplate; completion: ChecklistCompletion | null };

export function AssignToSeo({
  projectId,
  phaseId,
  seoPhaseId,
  seoPeople,
  items,
  canEdit,
}: {
  projectId: string;
  phaseId: string;
  seoPhaseId: string;
  seoPeople: Profile[];
  items: Item[];
  allChecked: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [seoId, setSeoId] = useState(seoPeople[0]?.id ?? "");
  const [devSummary, setDevSummary] = useState("");

  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    items.forEach((i) => (init[i.template.id] = Boolean(i.completion?.checked)));
    return init;
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    items.forEach((i) => (init[i.template.id] = i.completion?.note ?? ""));
    return init;
  });

  const allChecked =
    items.length > 0 && items.every((i) => checked[i.template.id]);
  const canAssign = allChecked && !!seoId && devSummary.trim().length > 0;

  function onToggle(templateId: string, next: boolean) {
    if (!canEdit) return;
    if (next && !notes[templateId]?.trim()) return; // gated by justification
    setChecked((c) => ({ ...c, [templateId]: next }));
    startTransition(() =>
      toggleChecklistItem(
        projectId,
        phaseId,
        templateId,
        next,
        notes[templateId] ?? "",
      ),
    );
  }

  function onNoteBlur(templateId: string) {
    if (!canEdit) return;
    startTransition(() =>
      saveChecklistNote(projectId, phaseId, templateId, notes[templateId] ?? ""),
    );
  }

  function onAssign() {
    setError(null);
    if (!canAssign) return;
    startTransition(async () => {
      try {
        await handoffToSeo({
          projectId,
          devPhaseId: phaseId,
          seoPhaseId,
          seoProfileId: seoId,
          devSummary,
        });
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <>
      <button
        className="btn-secondary border-primary text-primary hover:bg-primary hover:text-on-primary"
        onClick={() => setOpen(true)}
      >
        <Icon name="forward" size={18} />
        Assign to SEO
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Assign to SEO"
        description="Justify each item, write a completion summary, then hand off."
        maxWidth="max-w-lg"
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Developer checklist
            </p>
            <div className="space-y-2">
              {items.length === 0 && (
                <p className="text-sm text-ink-subtle">
                  No checklist items configured.
                </p>
              )}
              {items.map(({ template }) => {
                const isChecked = checked[template.id];
                const hasNote = !!notes[template.id]?.trim();
                return (
                  <div
                    key={template.id}
                    className={clsx(
                      "rounded-lg border p-3",
                      isChecked
                        ? "border-border bg-status-done-bg/30"
                        : "border-border bg-surface",
                    )}
                  >
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-ink-subtle text-primary focus:ring-primary disabled:opacity-40"
                        checked={isChecked}
                        disabled={!canEdit || pending || (!isChecked && !hasNote)}
                        onChange={(e) => onToggle(template.id, e.target.checked)}
                      />
                      <span
                        className={clsx(
                          "flex-1 text-sm font-medium",
                          isChecked
                            ? "text-status-done-text"
                            : "text-ink",
                        )}
                      >
                        {template.label}
                      </span>
                      {!hasNote && (
                        <span className="text-[11px] text-ink-subtle">
                          justify to check
                        </span>
                      )}
                    </label>
                    <textarea
                      rows={2}
                      className="input mt-2 h-auto py-2 text-sm"
                      placeholder="What did you do? (e.g. format used, form fields, from + emails)"
                      value={notes[template.id] ?? ""}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [template.id]: e.target.value }))
                      }
                      onBlur={() => onNoteBlur(template.id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="dev_summary">
              Completion summary <span className="text-status-error-text">*</span>
            </label>
            <textarea
              id="dev_summary"
              rows={4}
              className="input h-auto py-2"
              placeholder="Describe what was built, start to end…"
              value={devSummary}
              disabled={!canEdit}
              onChange={(e) => setDevSummary(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="seo_lead">
              Select SEO lead
            </label>
            <select
              id="seo_lead"
              className="input"
              value={seoId}
              onChange={(e) => setSeoId(e.target.value)}
            >
              {seoPeople.length === 0 && <option value="">No SEO users</option>}
              {seoPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-text">
              {error}
            </p>
          )}

          {!canAssign && (
            <div className="flex items-center justify-center gap-2 text-sm text-status-error-text">
              <Icon name="info" size={16} />
              Justify + check every item and write a summary to hand off
            </div>
          )}

          <div className="flex gap-3">
            <button
              className="btn-secondary flex-1"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary flex-1"
              disabled={!canAssign || pending}
              onClick={onAssign}
            >
              {pending ? "Assigning…" : "Assign"}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
