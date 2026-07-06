import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type { Country, Project } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");
  if (profile.approval_status !== "approved") redirect("/pending");

  const supabase = createClient();
  const [{ data: countries }, { data: projects }, { data: notifications }] =
    await Promise.all([
      supabase.from("countries").select("*").order("name"),
      supabase
        .from("projects")
        .select(
          "id, name, country_id, project_type, current_phase, developer_id, designer_id, seo_id, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("id, title, body, url, read, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        countries={(countries as Country[]) ?? []}
        projects={(projects as Project[]) ?? []}
        isManager={profile.role === "manager"}
        isSuperAdmin={profile.role === "super_admin"}
      />
      <div className="flex min-h-screen flex-col md:ml-[240px]">
        <Topbar profile={profile} notifications={notifications ?? []} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
