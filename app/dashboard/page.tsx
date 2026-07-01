import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";

export default async function DashboardHome() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const supabase = createClient();
  const { data: countries } = await supabase
    .from("countries")
    .select("id")
    .order("name")
    .limit(1);

  if (countries && countries.length > 0) {
    redirect(`/dashboard/${countries[0].id}`);
  }

  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon name="public" />
        </div>
        <h2 className="text-lg font-semibold">No countries yet</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {profile.role === "manager"
            ? "Use “Add country” in the sidebar to create your first workspace."
            : "Ask a manager to set up a country workspace to get started."}
        </p>
      </div>
    </div>
  );
}
