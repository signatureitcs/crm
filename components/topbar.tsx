import Link from "next/link";
import { ROLE_LABELS, profileRoles, type Profile } from "@/lib/types";
import { Icon } from "@/components/icon";
import {
  NotificationBell,
  type NotificationItem,
} from "@/components/notification-bell";
import { PresenceToggle } from "@/components/presence-toggle";
import { InstallButton } from "@/components/install-button";

export function Topbar({
  profile,
  title,
  notifications,
}: {
  profile: Profile;
  title?: string;
  notifications: NotificationItem[];
}) {
  const initials = profile.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface pl-16 pr-3 md:px-6">
      <div className="flex items-center gap-3">
        {title && <span className="text-base font-semibold">{title}</span>}
      </div>
      <div className="flex items-center gap-3">
        <InstallButton />
        <PresenceToggle presence={profile.presence} />
        <NotificationBell notifications={notifications} />
        <div className="flex items-center gap-3 border-l border-border pl-3">
          <Link href="/dashboard/settings" className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs text-ink-subtle">
                {profileRoles(profile).map((r) => ROLE_LABELS[r]).join(", ")}
              </p>
            </div>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                {initials}
              </div>
            )}
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-ink-subtle hover:text-status-error-text"
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" size={20} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
