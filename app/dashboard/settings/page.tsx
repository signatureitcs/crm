import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { SettingsProfile } from "@/components/settings-profile";
import { UserManagement } from "@/components/user-management";
import type { Profile } from "@/lib/types";

export default async function SettingsPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  let users: Profile[] = [];
  if (profile.role === "manager") {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    users = (data as Profile[]) ?? [];
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-ink-muted">
          Manage your profile{profile.role === "manager" ? " and your team" : ""}.
        </p>
      </div>

      <div className="space-y-8">
        <SettingsProfile profile={profile} />

        {profile.role === "manager" && (
          <UserManagement users={users} currentUserId={profile.id} />
        )}
      </div>
    </div>
  );
}
