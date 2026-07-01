"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Dialog } from "@/components/dialog";
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
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ProjectType>("website");

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
        <form action={addProject} className="space-y-4">
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create project
            </button>
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
