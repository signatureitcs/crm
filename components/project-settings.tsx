"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { SubmitButton } from "@/components/submit-button";
import { ROLE_LABELS, type Profile, type Project, type ProjectMember } from "@/lib/types";
import {
  addProjectMember,
  removeProjectMember,
  updateProjectMeta,
  deleteProject,
} from "@/app/dashboard/actions";

export function ProjectSettings({
  project,
  members,
  allProfiles,
}: {
  project: Project;
  members: ProjectMember[];
  allProfiles: Profile[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addId, setAddId] = useState("");

  const memberIds = new Set(members.map((m) => m.profile_id));
  const memberProfiles = allProfiles.filter((p) => memberIds.has(p.id));
  const addable = allProfiles.filter(
    (p) => !memberIds.has(p.id) && p.role !== "manager",
  );

  function onAdd() {
    if (!addId) return;
    startTransition(async () => {
      await addProjectMember(project.id, addId);
      setAddId("");
      router.refresh();
    });
  }

  function onRemove(profileId: string) {
    startTransition(async () => {
      await removeProjectMember(project.id, profileId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Client / metadata */}
      <section className="card p-5">
        <h3 className="mb-4 font-semibold">Project details</h3>
        <form action={updateProjectMeta} className="space-y-4">
          <input type="hidden" name="project_id" value={project.id} />
          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="input h-auto py-2"
              defaultValue={project.description ?? ""}
              placeholder="What is this project about?"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="client_name">
                Client name
              </label>
              <input
                id="client_name"
                name="client_name"
                className="input"
                defaultValue={project.client_name ?? ""}
                placeholder="Acme Towing Ltd"
              />
            </div>
            <div>
              <label className="label" htmlFor="client_contact">
                Client contact number(s)
              </label>
              <input
                id="client_contact"
                name="client_contact"
                className="input"
                defaultValue={project.client_contact ?? ""}
                placeholder="+44 20 1234 5678"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingText="Saving…">Save details</SubmitButton>
          </div>
        </form>
      </section>

      {/* Team */}
      <section className="card p-5">
        <h3 className="mb-1 font-semibold">Team members</h3>
        <p className="mb-4 text-sm text-ink-muted">
          Only members can see this project. Add the people working on it.
        </p>

        <div className="mb-4 flex gap-2">
          <select
            className="input"
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
          >
            <option value="">Select a person to add…</option>
            {addable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} · {ROLE_LABELS[p.role]}
              </option>
            ))}
          </select>
          <button
            onClick={onAdd}
            disabled={!addId || pending}
            className="btn-primary shrink-0"
          >
            <Icon name="person_add" size={18} />
            Add
          </button>
        </div>

        <div className="divide-y divide-border">
          {memberProfiles.length === 0 && (
            <p className="py-3 text-sm text-ink-subtle">No members yet.</p>
          )}
          {memberProfiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {p.full_name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{p.full_name}</p>
                  <p className="text-xs text-ink-subtle">{ROLE_LABELS[p.role]}</p>
                </div>
              </div>
              <button
                onClick={() => onRemove(p.id)}
                disabled={pending}
                className="text-ink-subtle hover:text-status-error-text"
                aria-label="Remove member"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Danger zone */}
      <section className="card border-status-error-text/20 p-5">
        <h3 className="mb-1 font-semibold text-status-error-text">Danger zone</h3>
        <p className="mb-4 text-sm text-ink-muted">
          Deleting a project removes all its tasks, assets, sitelinks, and logs.
          This cannot be undone.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="btn border border-status-error-text/40 text-status-error-text hover:bg-status-error-bg"
          >
            <Icon name="delete" size={18} />
            Delete project
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Are you sure?</span>
            <button
              onClick={() =>
                startTransition(() => deleteProject(project.id, project.country_id))
              }
              disabled={pending}
              className="btn bg-status-error-text text-white hover:opacity-90"
            >
              {pending ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
