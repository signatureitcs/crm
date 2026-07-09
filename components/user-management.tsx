"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Dialog } from "@/components/dialog";
import { SubmitButton } from "@/components/submit-button";
import { clsx } from "@/lib/clsx";
import {
  setUserRoles,
  createUser,
  setUserApproval,
  deleteUser,
} from "@/app/dashboard/settings/actions";
import { ROLE_LABELS, profileRoles, type Profile, type Role } from "@/lib/types";

const ROLE_OPTIONS = Object.keys(ROLE_LABELS) as Role[];

export function UserManagement({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function changeRoles(userId: string, roles: Role[]) {
    setRowError(null);
    startTransition(async () => {
      const res = await setUserRoles(userId, roles);
      if (res.ok) router.refresh();
      else setRowError(res.error ?? "Failed to update roles.");
    });
  }

  function approve(
    userId: string,
    status: "approved" | "rejected" | "suspended",
  ) {
    setRowError(null);
    startTransition(async () => {
      const res = await setUserApproval(userId, status);
      if (res.ok) router.refresh();
      else setRowError(res.error ?? "Failed to update approval.");
    });
  }

  function remove(userId: string, name: string) {
    if (
      !window.confirm(
        `Permanently delete ${name}? This removes their account and unassigns their work. This can't be undone.`,
      )
    )
      return;
    setRowError(null);
    startTransition(async () => {
      const res = await deleteUser(userId);
      if (res.ok) router.refresh();
      else setRowError(res.error ?? "Failed to delete user.");
    });
  }

  const pendingUsers = users.filter((u) => u.approval_status === "pending");

  return (
    <div className="space-y-4">
      {pendingUsers.length > 0 && (
        <div className="card border-status-progress-text/30 bg-status-progress-bg/30">
          <div className="border-b border-border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <Icon name="how_to_reg" size={18} className="text-status-progress-text" />
              Pending approvals
              <span className="badge bg-status-progress-bg text-status-progress-text">
                {pendingUsers.length}
              </span>
            </h3>
            <p className="text-sm text-ink-muted">
              New sign-ups can&apos;t access the app until you approve them.
            </p>
          </div>
          <div className="divide-y divide-border">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{u.full_name}</p>
                  <p className="text-xs text-ink-subtle">
                    Requested: {profileRoles(u).map((r) => ROLE_LABELS[r]).join(", ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary"
                    disabled={pending}
                    onClick={() => approve(u.id, "approved")}
                  >
                    <Icon name="check" size={16} />
                    Approve
                  </button>
                  <button
                    className="btn-secondary text-status-error-text"
                    disabled={pending}
                    onClick={() => approve(u.id, "rejected")}
                  >
                    <Icon name="close" size={16} />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="font-semibold">Team members</h3>
            <p className="text-sm text-ink-muted">
              Assign one or more roles, or add new users.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Icon name="person_add" size={18} />
            Add user
          </button>
        </div>

        {rowError && (
          <p className="border-b border-border bg-status-error-bg px-4 py-2 text-sm text-status-error-text">
            {rowError}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Name</th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Phone</th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Presence</th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Status</th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Roles</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-ink-subtle">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-subtle">
                  <td className="px-4 py-2 font-medium">
                    {u.full_name}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-xs text-ink-subtle">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-ink-muted">{u.phone ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 text-xs",
                        u.presence === "online" ? "text-status-done-text" : "text-ink-subtle",
                      )}
                    >
                      <span
                        className={clsx(
                          "h-2 w-2 rounded-full",
                          u.presence === "online" ? "bg-status-done-text" : "bg-ink-subtle",
                        )}
                      />
                      {u.presence === "online" ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={clsx(
                        "badge",
                        u.approval_status === "approved"
                          ? "bg-status-done-bg text-status-done-text"
                          : u.approval_status === "pending"
                            ? "bg-status-progress-bg text-status-progress-text"
                            : "bg-status-error-bg text-status-error-text",
                      )}
                    >
                      {u.approval_status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <RoleCell
                      user={u}
                      disabled={pending}
                      onChange={(roles) => changeRoles(u.id, roles)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {u.id === currentUserId ? (
                      <span className="block text-right text-xs text-ink-subtle">
                        —
                      </span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        {u.approval_status === "suspended" ? (
                          <button
                            className="rounded-lg px-2 py-1 text-xs font-medium text-status-done-text hover:bg-surface-subtle"
                            disabled={pending}
                            onClick={() => approve(u.id, "approved")}
                            title="Reactivate account"
                          >
                            Reactivate
                          </button>
                        ) : (
                          u.approval_status === "approved" && (
                            <button
                              className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-subtle"
                              disabled={pending}
                              onClick={() => approve(u.id, "suspended")}
                              title="Suspend account (blocks access)"
                            >
                              Suspend
                            </button>
                          )
                        )}
                        <button
                          className="rounded-lg p-1 text-ink-subtle hover:bg-status-error-bg hover:text-status-error-text"
                          disabled={pending}
                          onClick={() => remove(u.id, u.full_name)}
                          aria-label="Delete user"
                          title="Delete user"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Add user"
          description="Create an account and assign one or more roles."
        >
          <form
            action={async (fd) => {
              setError(null);
              const res = await createUser(fd);
              if (res.ok) {
                setOpen(false);
                router.refresh();
              } else {
                setError(res.error ?? "Failed to create user.");
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="label" htmlFor="nu_name">Full name</label>
              <input id="nu_name" name="full_name" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="nu_email">Email</label>
              <input id="nu_email" name="email" type="email" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="nu_pw">Temporary password</label>
              <input
                id="nu_pw"
                name="password"
                type="text"
                required
                minLength={6}
                className="input"
                placeholder="Share this with the user"
              />
            </div>
            <div>
              <label className="label">Roles</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <label
                    key={r}
                    className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="roles"
                      value={r}
                      defaultChecked={r === "developer"}
                      className="h-4 w-4 rounded border-ink-subtle text-primary focus:ring-primary"
                    />
                    {ROLE_LABELS[r]}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-subtle">
                Manager and super admin are exclusive — if picked, other roles are ignored.
              </p>
            </div>
            {error && (
              <p className="rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-text">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <SubmitButton pendingText="Creating…">Create user</SubmitButton>
            </div>
          </form>
        </Dialog>
      </div>
    </div>
  );
}

function RoleCell({
  user,
  disabled,
  onChange,
}: {
  user: Profile;
  disabled: boolean;
  onChange: (roles: Role[]) => void;
}) {
  const current = profileRoles(user);
  function toggle(r: Role) {
    const next = current.includes(r)
      ? current.filter((x) => x !== r)
      : [...current, r];
    onChange(next);
  }
  return (
    <details className="group relative">
      <summary className="input flex h-8 w-52 cursor-pointer list-none items-center truncate py-0 text-xs">
        <span className="truncate">
          {current.map((r) => ROLE_LABELS[r]).join(", ") || "No role"}
        </span>
        <Icon name="expand_more" size={16} className="ml-auto text-ink-subtle" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-border bg-surface p-1 shadow-lg">
        {ROLE_OPTIONS.map((r) => (
          <label
            key={r}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-surface-subtle"
          >
            <input
              type="checkbox"
              checked={current.includes(r)}
              disabled={disabled}
              onChange={() => toggle(r)}
              className="h-4 w-4 rounded border-ink-subtle text-primary focus:ring-primary"
            />
            {ROLE_LABELS[r]}
          </label>
        ))}
      </div>
    </details>
  );
}
