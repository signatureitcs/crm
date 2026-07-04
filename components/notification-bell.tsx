"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { clsx } from "@/lib/clsx";
import { formatDate } from "@/lib/format";
import {
  pushSupported,
  registerServiceWorker,
  subscribeToPush,
} from "@/lib/push-client";
import {
  savePushSubscription,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/notifications/actions";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!pushSupported()) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    // Register SW early so pushes are received once subscribed.
    registerServiceWorker();
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const sub = await subscribeToPush();
      if (sub) {
        await savePushSubscription(sub);
        setPermission("granted");
      } else {
        setPermission(Notification.permission);
      }
    } finally {
      setBusy(false);
    }
  }

  async function openItem(n: NotificationItem) {
    if (!n.read) await markNotificationRead(n.id);
    setOpen(false);
    if (n.url) router.push(n.url);
    else router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-ink-subtle hover:text-primary"
        aria-label="Notifications"
      >
        <Icon name="notifications" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-error-text px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {permission !== "granted" && permission !== "unsupported" && (
            <button
              onClick={enable}
              disabled={busy}
              className="flex w-full items-center gap-2 border-b border-border bg-primary-soft/40 px-4 py-2.5 text-left text-sm text-primary hover:bg-primary-soft disabled:opacity-60"
            >
              <Icon name="notifications_active" size={18} />
              {busy ? "Enabling…" : "Enable push notifications on this device"}
            </button>
          )}
          {permission === "denied" && (
            <p className="border-b border-border px-4 py-2 text-xs text-ink-subtle">
              Notifications are blocked in your browser settings.
            </p>
          )}

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-ink-subtle">
                No notifications yet.
              </p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={clsx(
                  "flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-3 text-left hover:bg-surface-subtle",
                  !n.read && "bg-primary-soft/20",
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium">{n.title}</span>
                  {!n.read && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                {n.body && (
                  <span className="text-xs text-ink-muted">{n.body}</span>
                )}
                <span className="text-[11px] text-ink-subtle">
                  {formatDate(n.created_at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
