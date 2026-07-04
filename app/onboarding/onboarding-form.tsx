"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, SELF_SELECT_ROLES, type Role } from "@/lib/types";

export function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("developer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .insert({ id: user.id, full_name: fullName, role });
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
        <label className="label" htmlFor="role">
          Role
        </label>
        <select
          id="role"
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {SELF_SELECT_ROLES.map((r) => (
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
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
