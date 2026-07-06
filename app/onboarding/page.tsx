import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">Signature CRM</h1>
          <p className="mt-1 text-sm text-ink-muted">One more step</p>
        </div>
        <div className="card p-6">
          <h2 className="mb-1 text-lg font-semibold">Complete your profile</h2>
          <p className="mb-5 text-sm text-ink-muted">
            Tell us who you are and your role on the team.
          </p>
          <OnboardingForm email={user.email ?? ""} />
        </div>
      </div>
    </div>
  );
}
