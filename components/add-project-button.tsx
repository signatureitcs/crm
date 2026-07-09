"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Dialog } from "@/components/dialog";
import { SubmitButton } from "@/components/submit-button";
import { addProject } from "@/app/dashboard/actions";
import type { Profile, ProjectType } from "@/lib/types";

export function AddProjectButton({
  countryId,
  developers,
  designers,
  seos,
}: {
  countryId: string;
  developers: Profile[];
  designers: Profile[];
  seos: Profile[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ProjectType>("website");
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Icon name="add" size={18} />
        Add project
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add project"
        description="Create a website or GMB project in this country."
      >
        <form
          action={async (fd) => {
            setError(null);
            const res = await addProject(fd);
            if (res.ok && res.redirectTo) {
              setOpen(false);
              router.push(res.redirectTo);
              router.refresh();
            } else {
              setError(res.error ?? "Failed to create project.");
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="country_id" value={countryId} />

          <div>
            <label className="label" htmlFor="name">
              Project name
            </label>
            <input
              id="name"
              name="name"
              required
              className="input"
              placeholder="abctow.com"
              autoFocus
            />
          </div>

          <div>
            <label className="label" htmlFor="description">
              Description <span className="text-ink-subtle">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="input h-auto py-2"
              placeholder="Short summary of the project"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="client_name">
                Client name
              </label>
              <input id="client_name" name="client_name" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="client_contact">
                Client contact
              </label>
              <input
                id="client_contact"
                name="client_contact"
                className="input"
                placeholder="Phone / email"
              />
            </div>
          </div>

          <div>
            <label className="label">Project type</label>
            <div className="grid grid-cols-2 gap-2">
              {(["website", "gmb"] as ProjectType[]).map((t) => (
                <label
                  key={t}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    type === t
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border text-ink-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="project_type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="sr-only"
                  />
                  <Icon
                    name={t === "gmb" ? "location_on" : "dns"}
                    size={18}
                  />
                  {t === "gmb" ? "GMB listing" : "Website"}
                </label>
              ))}
            </div>
          </div>

          {type === "website" && (
            <div className="grid grid-cols-1 gap-3">
              <PersonSelect label="Designer" name="designer_id" people={designers} />
              <PersonSelect
                label="Developer"
                name="developer_id"
                people={developers}
              />
              <PersonSelect label="SEO specialist" name="seo_id" people={seos} />
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-text">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <SubmitButton pendingText="Creating…">Create project</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function PersonSelect({
  label,
  name,
  people,
}: {
  label: string;
  name: string;
  people: Profile[];
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} className="input" defaultValue="">
        <option value="">Unassigned</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}
      </select>
    </div>
  );
}
