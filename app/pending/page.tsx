import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Icon } from "@/components/icon";

export default async function PendingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.approval_status === "approved") redirect("/dashboard");

  const status = profile.approval_status;
  const blocked = status === "rejected" || status === "suspended";
  const heading =
    status === "suspended"
      ? "Account suspended"
      : status === "rejected"
        ? "Access declined"
        : "Awaiting approval";
  const message =
    status === "suspended"
      ? "A manager has suspended your account. Contact your manager to restore access."
      : status === "rejected"
        ? "A manager has declined your account. If you think this is a mistake, contact your manager."
        : "Your account has been created and is waiting for a manager to approve it. You'll get access as soon as it's approved.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-6 text-2xl font-bold text-primary">Signature CRM</h1>
        <div className="card p-8">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              blocked
                ? "bg-status-error-bg text-status-error-text"
                : "bg-status-progress-bg text-status-progress-text"
            }`}
          >
            <Icon name={blocked ? "block" : "hourglass_top"} size={28} />
          </div>
          <h2 className="text-lg font-semibold">{heading}</h2>
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
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
