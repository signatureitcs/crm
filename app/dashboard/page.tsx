import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function DashboardHome() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  // Route each role to its home.
  if (profile.role === "manager") redirect("/dashboard/manager");
  if (profile.role === "super_admin") redirect("/dashboard/super-admin");
  redirect("/dashboard/overview");
}
