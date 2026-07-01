"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { gmbBadge } from "@/lib/format";
import { setGmbStatus, saveListingLink } from "@/app/dashboard/project/actions";
import type { GmbTask, GmbTaskStatus, GmbTaskType } from "@/lib/types";

const META: Record<GmbTaskType, { title: string; blurb: string }> = {
  emails_assigned: {
    title: "Emails assigned (outreach)",
    blurb: "Outreach templates drafted and assigned to the team.",
  },
  reviews_done: {
    title: "Reviews responded to",
    blurb: "Respond to pending Google reviews, prioritising negatives.",
  },
  listing_live: {
    title: "Listing made live",
    blurb: "Verify the GMB listing, then paste the public URL below.",
  },
};

export function GmbChecklist({
  projectId,
  tasks,
  canEdit,
}: {
  projectId: string;
  tasks: GmbTask[];
  canEdit: boolean;
}) {
  return (
    <div className="divide-y divide-border">
      {tasks.map((task) => (
        <GmbRow
          key={task.id}
          projectId={projectId}
          task={task}
          canEdit={canEdit}
        />
      ))}
      {tasks.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-ink-subtle">
          No GMB tasks for this project.
        </p>
      )}
    </div>
  );
}

function GmbRow({
  projectId,
  task,
  canEdit,
}: {
  projectId: string;
  task: GmbTask;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState(task.listing_link ?? "");
  const meta = META[task.task_type];
  const badge = gmbBadge(task.status);
  const done = task.status === "done";

  function changeStatus(status: GmbTaskStatus) {
    startTransition(async () => {
      await setGmbStatus(task.id, projectId, status);
      router.refresh();
    });
  }

  function saveLink() {
    startTransition(async () => {
      await saveListingLink(task.id, projectId, link.trim());
      router.refresh();
    });
  }

  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <Icon
        name={done ? "check_box" : "check_box_outline_blank"}
        filled={done}
        className={done ? "text-status-done-text" : "text-ink-subtle"}
      />
      <div className="flex-1">
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-medium">{meta.title}</h4>
          <span className={`badge ${badge.className}`}>{badge.label}</span>
        </div>
        <p className="mb-3 text-sm text-ink-muted">{meta.blurb}</p>

        {task.task_type === "listing_live" ? (
          <div>
            <label className="label">Live listing link</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={link}
                disabled={!canEdit}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://google.com/maps/place/…"
              />
              {canEdit && (
                <button
                  onClick={saveLink}
                  disabled={pending}
                  className="btn-primary shrink-0"
                >
                  Save
                </button>
              )}
            </div>
            {task.listing_link && (
              <a
                href={task.listing_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Icon name="open_in_new" size={14} />
                View live listing
              </a>
            )}
          </div>
        ) : (
          canEdit && (
            <select
              className="input max-w-[200px]"
              value={task.status}
              disabled={pending}
              onChange={(e) => changeStatus(e.target.value as GmbTaskStatus)}
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          )
        )}
      </div>
    </div>
  );
}
