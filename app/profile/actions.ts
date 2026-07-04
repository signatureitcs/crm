"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Presence } from "@/lib/types";

async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export async function setPresence(presence: Presence) {
  const { supabase, userId } = await getUser();
  const { error } = await supabase
    .from("profiles")
    .update({ presence })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/manager");
}

export async function updateMyProfile(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();
  if (!fullName) return;
  const { supabase, userId } = await getUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone || null,
      avatar_url: avatarUrl || null,
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
}
