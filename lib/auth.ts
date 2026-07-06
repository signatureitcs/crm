import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Returns the signed-in user's profile, or null if not signed in / no profile.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}

// Like getCurrentProfile but redirects to /login when unauthenticated, and to
// /pending when the account hasn't been approved by a manager yet.
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.approval_status !== "approved") redirect("/pending");
  return profile;
}

export function isManager(profile: Profile | null): boolean {
  return profile?.role === "manager";
}
