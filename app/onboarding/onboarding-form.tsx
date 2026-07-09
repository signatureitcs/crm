"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "@/lib/clsx";
import { ROLE_LABELS, MULTI_SELECT_ROLES, type Role } from "@/lib/types";

export function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  // Self-registration offers team roles only; manager/super admin are
  // assigned by a manager afterwards.
  const [roles, setRoles] = useState<Role[]>(["developer"]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleRole(r: Role) {
    setRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const finalRoles: Role[] = roles;
    if (finalRoles.length === 0) {
      setError("Pick at least one role.");
      return;
    }

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      role: finalRoles[0],
      roles: finalRoles,
    });
    setLoading(false);
    if (error) return setError(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input className="input bg-surface-subtle" value={email} disabled />
      </div>
      <div>
        <label className="label" htmlFor="full_name">
          Full name
        </label>
        <input
          id="full_name"
          required
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
        />
      </div>

      <div>
        <label className="label">Your role(s)</label>
        <div className="grid grid-cols-2 gap-2">
          {MULTI_SELECT_ROLES.map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => toggleRole(r)}
              className={clsx(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                roles.includes(r)
                  ? "border-primary bg-primary-soft font-medium text-primary"
                  : "border-border text-ink-muted hover:border-primary",
              )}
            >
              <span
                className={clsx(
                  "material-symbols-outlined text-[18px]",
                  roles.includes(r) ? "text-primary" : "text-ink-subtle",
                )}
              >
                {roles.includes(r) ? "check_box" : "check_box_outline_blank"}
              </span>
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-subtle">
          Pick every hat you wear. Manager, QA and super admin are assigned by a
          manager.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-status-error-bg px-3 py-2 text-sm text-status-error-text">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
