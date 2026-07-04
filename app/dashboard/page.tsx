import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function DashboardHome() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  // Managers land on the global dashboard; everyone else on their overview.
  if (profile.role === "manager") redirect("/dashboard/manager");
  redirect("/dashboard/overview");
}
