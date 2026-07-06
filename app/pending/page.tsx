import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";

export default async function PendingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.approval_status === "approved") redirect("/dashboard");

  const rejected = profile.approval_status === "rejected";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-6 text-2xl font-bold text-primary">Signature CRM</h1>
        <div className="card p-8">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              rejected
                ? "bg-status-error-bg text-status-error-text"
                : "bg-status-progress-bg text-status-progress-text"
            }`}
          >
            <Icon name={rejected ? "block" : "hourglass_top"} size={28} />
          </div>
          <h2 className="text-lg font-semibold">
            {rejected ? "Access declined" : "Awaiting approval"}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {rejected
              ? "A manager has declined your account. If you think this is a mistake, contact your manager."
              : "Your account has been created and is waiting for a manager to approve it. You'll get access as soon as it's approved."}
          </p>
          <p className="mt-4 text-sm font-medium">{profile.full_name}</p>
          <form action="/auth/signout" method="post" className="mt-6">
            <button type="submit" className="btn-secondary w-full">
              <Icon name="logout" size={18} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
