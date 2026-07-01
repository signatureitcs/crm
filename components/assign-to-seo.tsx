"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Dialog } from "@/components/dialog";
import { clsx } from "@/lib/clsx";
import {
  toggleChecklistItem,
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

  // Local checked state, keyed by template id — drives the disabled gate.
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    items.forEach((i) => (init[i.template.id] = Boolean(i.completion?.checked)));
    return init;
  });

  const allChecked =
    items.length > 0 && items.every((i) => checked[i.template.id]);

  function onToggle(templateId: string, next: boolean) {
    if (!canEdit) return;
    setChecked((c) => ({ ...c, [templateId]: next }));
    startTransition(() =>
      toggleChecklistItem(projectId, phaseId, templateId, next),
    );
  }

  function onAssign() {
    setError(null);
    if (!allChecked || !seoId) return;
    startTransition(async () => {
      try {
        await handoffToSeo({
          projectId,
          devPhaseId: phaseId,
          seoPhaseId,
          seoProfileId: seoId,
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
        description="Final developer sign-off required before transition."
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Checklist
            </p>
            <div className="space-y-2">
              {items.length === 0 && (
                <p className="text-sm text-ink-subtle">
                  No checklist items configured.
                </p>
              )}
              {items.map(({ template }) => {
                const isChecked = checked[template.id];
                return (
                  <label
                    key={template.id}
                    className={clsx(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                      isChecked
                        ? "border-border bg-status-done-bg/30 font-medium text-status-done-text"
                        : "border-status-error-text/20 bg-status-error-bg/50 font-medium text-status-error-text",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink-subtle text-primary focus:ring-primary"
                      checked={isChecked}
                      disabled={!canEdit || pending}
                      onChange={(e) => onToggle(template.id, e.target.checked)}
                    />
                    <span className="flex-1">{template.label}</span>
                    {!isChecked && (
                      <Icon name="priority_high" size={18} />
                    )}
                  </label>
                );
              })}
            </div>
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

          {!allChecked && (
            <div className="flex items-center justify-center gap-2 text-sm text-status-error-text">
              <Icon name="info" size={16} />
              Complete all checklist items to hand off
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
              disabled={!allChecked || !seoId || pending}
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
