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
function urlRef(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .replace(/^https?:\/\//, "")
    .split(".")[0];
}

function diagnoseServiceKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY is not set.";
  if (key.trim() !== key)
    return "SUPABASE_SERVICE_ROLE_KEY has leading/trailing whitespace — re-paste it cleanly (no spaces or line breaks).";
  if (/^["'].*["']$/.test(key))
    return "SUPABASE_SERVICE_ROLE_KEY is wrapped in quotes — remove the surrounding quotes in Vercel.";
  // New-style secret keys (sb_secret_…) aren't JWTs; skip the JWT checks.
  if (key.startsWith("sb_")) return null;

  if (/\s/.test(key))
    return "SUPABASE_SERVICE_ROLE_KEY contains a space or line break inside it — the value got wrapped/split on paste. Re-copy the whole key with the Copy button and paste it as one line.";

  const parts = key.split(".");
  if (parts.length !== 3)
    return "SUPABASE_SERVICE_ROLE_KEY doesn't look like a Supabase key. Copy the service_role secret from Supabase → Project Settings → API.";
  // HS256 signature is ~43 base64url chars; much shorter means it was truncated.
  if (parts[2].length < 40)
    return "SUPABASE_SERVICE_ROLE_KEY looks truncated (its signature is cut off). Use the Copy button in Supabase and paste the entire key — it's long.";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    if (payload.role && payload.role !== "service_role") {
      return `SUPABASE_SERVICE_ROLE_KEY is a "${payload.role}" key, not the service_role secret. Copy the service_role key (Supabase → Project Settings → API → service_role).`;
    }
    const ref = urlRef();
    if (payload.ref && ref && payload.ref !== ref) {
      return `Project mismatch: the service key is for project "${payload.ref}" but NEXT_PUBLIC_SUPABASE_URL points to "${ref}". Both must be from the same project.`;
    }
  } catch {
    /* couldn't decode — let the real API call report the error */
  }
  return null;
}

// Human-readable detail about the configured key vs URL, appended to
// "Invalid API key" so the mismatch is obvious even when the format looks fine.
function serviceKeyDetail(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const ref = urlRef() || "(none)";
  if (key.startsWith("sb_"))
    return ` — using a new-style secret key; URL project is "${ref}".`;
  // Length + last 6 chars reveal a truncated/wrong deployed value without
  // leaking the secret (6 chars can't reconstruct the key).
  const fp = ` [deployed key: length=${key.length}, ends "${key.slice(-6)}"]`;
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1] ?? "", "base64").toString("utf8"),
    );
    return ` — key role="${payload.role}", key project="${payload.ref}", URL project="${ref}".${fp} If the length/ending don't match the real service_role key, Vercel is running a stale/truncated value — re-save it and redeploy.`;
  } catch {
    return ` — URL project="${ref}".${fp} The key isn't a decodable JWT; re-copy the service_role secret.`;
  }
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
    if (createErr) {
      const suffix = /invalid api key/i.test(createErr.message)
        ? serviceKeyDetail()
        : "";
      return { ok: false, error: `Auth: ${createErr.message}${suffix}` };
    }

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
