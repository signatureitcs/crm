"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
  const sha12 = key
    ? createHash("sha256").update(key).digest("hex").slice(0, 12)
    : "none";
  const fp = ` [deployed key: length=${key.length}, ends "${key.slice(-6)}", sha12=${sha12}]`;
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

export async function setUserRoles(
  userId: string,
  roles: Role[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const clean = roles.filter((r) => VALID_ROLES.includes(r));
    if (clean.length === 0) throw new Error("Pick at least one role.");
    // Manager and super admin are exclusive.
    let finalRoles: Role[] = clean;
    if (clean.includes("manager")) finalRoles = ["manager"];
    else if (clean.includes("super_admin")) finalRoles = ["super_admin"];

    const { supabase, userId: me } = await requireManager();
    if (userId === me && !finalRoles.includes("manager")) {
      throw new Error("You can't remove your own manager role.");
    }
    const { error } = await supabase
      .from("profiles")
      .update({ role: finalRoles[0], roles: finalRoles })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/manager");
    return { ok: true };
  } catch (e) {
    console.error("[setUserRoles]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update roles.",
    };
  }
}

export async function setUserApproval(
  userId: string,
  status: "approved" | "rejected" | "suspended",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId: me } = await requireManager();
    if (userId === me && status !== "approved") {
      throw new Error("You can't suspend your own account.");
    }
    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: status })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    console.error("[setUserApproval]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update approval.",
    };
  }
}

// Permanently delete a user (auth account + profile cascade).
export async function deleteUser(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId: me } = await requireManager();
    if (userId === me) {
      return { ok: false, error: "You can't delete your own account." };
    }
    const diag = diagnoseServiceKey();
    if (diag) return { ok: false, error: diag };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Delete ${res.status}: ${t.slice(0, 200)}` };
    }
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    console.error("[deleteUser]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete user.",
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

    const picked = (
      formData.getAll("roles").length
        ? (formData.getAll("roles") as string[])
        : [String(formData.get("role") ?? "")]
    ).filter((r): r is Role => VALID_ROLES.includes(r as Role));
    let roles: Role[] = picked;
    if (picked.includes("manager")) roles = ["manager"];
    else if (picked.includes("super_admin")) roles = ["super_admin"];

    if (!email || password.length < 6 || !fullName || roles.length === 0) {
      return {
        ok: false,
        error:
          "Fill in email, a 6+ char password, name, and at least one role.",
      };
    }

    // Creating an auth account requires the service role (server-only).
    const diag = diagnoseServiceKey();
    if (diag) return { ok: false, error: diag };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // 1) Create the auth user via the GoTrue admin endpoint (raw fetch so we
    //    see the exact status + message instead of a wrapped one).
    const authRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      }),
    });
    const authText = await authRes.text();
    let authJson: Record<string, unknown> = {};
    try {
      authJson = JSON.parse(authText);
    } catch {
      /* non-JSON body */
    }
    if (!authRes.ok) {
      const msg =
        (authJson.msg as string) ||
        (authJson.message as string) ||
        (authJson.error_description as string) ||
        authText.slice(0, 200);
      const detail = /invalid api key/i.test(msg) ? serviceKeyDetail() : "";
      return { ok: false, error: `Auth ${authRes.status}: ${msg}${detail}` };
    }

    const newId = authJson.id as string | undefined;
    if (!newId) return { ok: false, error: "User created but no id returned." };

    // 2) Insert the profile row via PostgREST.
    const profRes = await fetch(`${url}/rest/v1/profiles`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        id: newId,
        full_name: fullName,
        role: roles[0],
        roles,
      }),
    });
    if (!profRes.ok) {
      const t = await profRes.text();
      // Roll back the auth user so the manager can retry cleanly.
      await fetch(`${url}/auth/v1/admin/users/${newId}`, {
        method: "DELETE",
        headers,
      });
      return { ok: false, error: `Profile ${profRes.status}: ${t.slice(0, 200)}` };
    }

    // NOTE: no revalidatePath() here — it forces a server re-render inside the
    // action response, and any error there would mask this result. The client
    // calls router.refresh() instead.
    return { ok: true };
  } catch (e) {
    console.error("[createUser]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create user.",
    };
  }
}
