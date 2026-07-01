"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { Dialog } from "@/components/dialog";
import { clsx } from "@/lib/clsx";
import type { Country, Project } from "@/lib/types";
import { addCountry } from "@/app/dashboard/actions";

export function Sidebar({
  countries,
  projects,
  isManager,
}: {
  countries: Country[];
  projects: Project[];
  isManager: boolean;
}) {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // expand the country whose project is currently open
    const init: Record<string, boolean> = {};
    countries.forEach((c) => (init[c.id] = true));
    return init;
  });

  function projectHref(p: Project) {
    return p.project_type === "gmb"
      ? `/dashboard/gmb/${p.id}`
      : `/dashboard/project/${p.id}`;
  }

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-full w-[240px] flex-col border-r border-border bg-surface">
      <div className="p-6">
        <Link href="/dashboard">
          <h1 className="text-xl font-bold text-primary">Project Hub</h1>
        </Link>
        <p className="text-sm text-ink-muted">Agency dashboard</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Countries
        </p>
        <div className="space-y-0.5">
          {countries.map((country) => {
            const countryProjects = projects.filter(
              (p) => p.country_id === country.id,
            );
            const isActiveCountry = pathname === `/dashboard/${country.id}`;
            const open = expanded[country.id] ?? false;
            return (
              <div key={country.id}>
                <div
                  className={clsx(
                    "group flex h-10 items-center rounded-lg pr-2",
                    isActiveCountry
                      ? "bg-status-todo-bg font-medium text-primary"
                      : "text-ink-muted hover:bg-surface-subtle",
                  )}
                >
                  <button
                    onClick={() =>
                      setExpanded((e) => ({ ...e, [country.id]: !open }))
                    }
                    className="flex h-full w-7 items-center justify-center text-ink-subtle"
                    aria-label="Toggle"
                  >
                    <Icon
                      name="chevron_right"
                      size={18}
                      className={clsx(
                        "transition-transform",
                        open && "rotate-90",
                      )}
                    />
                  </button>
                  <Link
                    href={`/dashboard/${country.id}`}
                    className="flex flex-1 items-center gap-2 text-sm"
                  >
                    <Icon name="flag" size={20} />
                    <span>{country.name}</span>
                  </Link>
                </div>

                {open && (
                  <div className="ml-9 mt-0.5 space-y-0.5 border-l border-border pl-2">
                    {countryProjects.length === 0 && (
                      <p className="px-2 py-1 text-xs text-ink-subtle">
                        No projects
                      </p>
                    )}
                    {countryProjects.map((p) => {
                      const href = projectHref(p);
                      const active = pathname.startsWith(href);
                      return (
                        <Link
                          key={p.id}
                          href={href}
                          className={clsx(
                            "flex h-8 items-center gap-2 rounded-lg px-2 text-sm",
                            active
                              ? "font-medium text-primary"
                              : "text-ink-muted hover:text-primary",
                          )}
                        >
                          <Icon
                            name={p.project_type === "gmb" ? "location_on" : "dns"}
                            size={16}
                          />
                          <span className="truncate">{p.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isManager && (
          <div className="mt-6 px-1">
            <button
              onClick={() => setAddOpen(true)}
              className="btn-primary w-full"
            >
              <Icon name="add" size={18} />
              Add country
            </button>
          </div>
        )}
      </nav>

      <div className="space-y-0.5 border-t border-border p-3">
        <SidebarFooterLink icon="settings" label="Settings" />
        <SidebarFooterLink icon="help" label="Support" />
      </div>

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add country"
        description="Create a new country workspace."
      >
        <form action={addCountry} onSubmit={() => setAddOpen(false)} className="space-y-4">
          <div>
            <label className="label" htmlFor="country_name">
              Country name
            </label>
            <input
              id="country_name"
              name="name"
              required
              className="input"
              placeholder="Germany"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add country
            </button>
          </div>
        </form>
      </Dialog>
    </aside>
  );
}

function SidebarFooterLink({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-ink-muted hover:bg-surface-subtle">
      <Icon name={icon} size={20} />
      <span>{label}</span>
    </div>
  );
}
