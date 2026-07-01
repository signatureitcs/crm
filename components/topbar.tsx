import { ROLE_LABELS, type Profile } from "@/lib/types";
import { Icon } from "@/components/icon";

export function Topbar({
  profile,
  title,
}: {
  profile: Profile;
  title?: string;
}) {
  const initials = profile.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-3">
        {title && <span className="text-base font-semibold">{title}</span>}
      </div>
      <div className="flex items-center gap-4">
        <Icon
          name="notifications"
          className="cursor-pointer text-ink-subtle hover:text-primary"
        />
        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{profile.full_name}</p>
            <p className="text-xs text-ink-subtle">{ROLE_LABELS[profile.role]}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {initials}
          </div>
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
