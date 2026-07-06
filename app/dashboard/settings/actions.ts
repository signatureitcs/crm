"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

const VALID_ROLES: Role[] = [
  "manager",
  "developer",
  "designer",
  "seo",
  "gmb",
  "qa",
  "super_admin",
];

// Inspects the configured service-role key and returns a precise problem
// message, or null if it looks valid. Helps diagnose "Invalid API key".
function diagnoseServiceKey(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY is not set.";
  if (key.trim() !== key)
    return "SUPABASE_SERVICE_ROLE_KEY has leading/trailing whitespace — re-paste it cleanly.";
  // New-style secret keys (sb_secret_…) aren't JWTs; skip the JWT checks.
  if (key.startsWith("sb_")) return null;

  const parts = key.split(".");
  if (parts.length !== 3)
    return "SUPABASE_SERVICE_ROLE_KEY doesn't look like a Supabase key. Copy the service_role secret from Supabase → Project Settings → API.";
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8"),
    );
    if (payload.role && payload.role !== "service_role") {
      return `SUPABASE_SERVICE_ROLE_KEY is a "${payload.role}" key, not the service_role secret. Copy the service_role key (Supabase → Project Settings → API → service_role).`;
    }
    const urlRef = url.replace(/^https?:\/\//, "").split(".")[0];
    if (payload.ref && urlRef && payload.ref !== urlRef) {
      return `Project mismatch: the service key is for project "${payload.ref}" but NEXT_PUBLIC_SUPABASE_URL points to "${urlRef}". Both must be from the same project.`;
    }
  } catch {
    /* couldn't decode — let the real API call report the error */
  }
  return null;
}

// Throws plain Errors (never redirect()) so callers can surface the reason.
async function requireManager() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "manager") {
    throw new Error("Only managers can manage users.");
  }
  return { supabase, userId: user.id };
}

export async function setUserRole(
  userId: string,
  role: Role,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!VALID_ROLES.includes(role)) throw new Error("Invalid role.");
    const { supabase, userId: me } = await requireManager();
    if (userId === me && role !== "manager") {
      throw new Error("You can't remove your own manager role.");
    }
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    console.error("[setUserRole]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update role.",
    };
  }
}

export async function createUser(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireManager();

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("full_name") ?? "").trim();
    const role = String(formData.get("role") ?? "") as Role;

    if (!email || password.length < 6 || !fullName || !VALID_ROLES.includes(role)) {
      return {
        ok: false,
        error: "Fill in email, a 6+ char password, name, and a valid role.",
      };
    }

    // Creating an auth account requires the service role (server-only).
    const diag = diagnoseServiceKey();
    if (diag) return { ok: false, error: diag };
    const admin = createServiceClient();
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
    if (createErr) return { ok: false, error: `Auth: ${createErr.message}` };

    const newId = created.user?.id;
    if (!newId) return { ok: false, error: "User was not created." };

    const { error: profileErr } = await admin
      .from("profiles")
      .insert({ id: newId, full_name: fullName, role });
    if (profileErr) {
      // Roll back the auth user so the manager can retry cleanly.
      await admin.auth.admin.deleteUser(newId);
      return { ok: false, error: `Profile: ${profileErr.message}` };
    }

    // NOTE: intentionally no revalidatePath() here — it forces a server
    // re-render inside the action response, and any error on those pages would
    // mask this result. The client calls router.refresh() instead.
    return { ok: true };
  } catch (e) {
    console.error("[createUser]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create user.",
    };
  }
}
