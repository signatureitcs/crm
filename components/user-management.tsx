"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Dialog } from "@/components/dialog";
import { SubmitButton } from "@/components/submit-button";
import { clsx } from "@/lib/clsx";
import {
  setUserRole,
  createUser,
  setUserApproval,
} from "@/app/dashboard/settings/actions";
import { ROLE_LABELS, type Profile, type Role } from "@/lib/types";

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

  function changeRole(userId: string, role: Role) {
    setRowError(null);
    startTransition(async () => {
      const res = await setUserRole(userId, role);
      if (res.ok) {
        router.refresh();
      } else {
        setRowError(res.error ?? "Failed to update role.");
      }
    });
  }

  function approve(userId: string, status: "approved" | "rejected") {
    setRowError(null);
    startTransition(async () => {
      const res = await setUserApproval(userId, status);
      if (res.ok) {
        router.refresh();
      } else {
        setRowError(res.error ?? "Failed to update approval.");
      }
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
                    Requested role: {ROLE_LABELS[u.role]}
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
            Assign roles (including QA and super admin) or add new users.
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
              <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Role</th>
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
                      u.presence === "online"
                        ? "text-status-done-text"
                        : "text-ink-subtle",
                    )}
                  >
                    <span
                      className={clsx(
                        "h-2 w-2 rounded-full",
                        u.presence === "online"
                          ? "bg-status-done-text"
                          : "bg-ink-subtle",
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
                  <select
                    className="input h-8 w-40 py-0"
                    value={u.role}
                    disabled={pending}
                    onChange={(e) => changeRole(u.id, e.target.value as Role)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
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
        description="Create an account and assign a role."
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
            <label className="label" htmlFor="nu_role">Role</label>
            <select id="nu_role" name="role" className="input" defaultValue="developer">
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
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
