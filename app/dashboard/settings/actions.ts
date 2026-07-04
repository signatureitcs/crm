"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

async function requireManager() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
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

export async function setUserRole(userId: string, role: Role) {
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
  revalidatePath("/dashboard/manager");
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
    const admin = createServiceClient();
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
    if (createErr) return { ok: false, error: createErr.message };

    const newId = created.user?.id;
    if (!newId) return { ok: false, error: "User was not created." };

    const { error: profileErr } = await admin
      .from("profiles")
      .insert({ id: newId, full_name: fullName, role });
    if (profileErr) {
      // Roll back the auth user so the manager can retry cleanly.
      await admin.auth.admin.deleteUser(newId);
      return { ok: false, error: profileErr.message };
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/manager");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create user.",
    };
  }
}
