"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { setPresence } from "@/app/profile/actions";
import type { Presence } from "@/lib/types";

export function PresenceToggle({ presence }: { presence: Presence }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Presence>(presence);
  const [pending, startTransition] = useTransition();
  const online = current === "online";

  function toggle() {
    const next: Presence = online ? "offline" : "online";
    setCurrent(next);
    startTransition(async () => {
      await setPresence(next);
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={online ? "You are online — click to go offline" : "You are offline — click to go online"}
      className={clsx(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        online
          ? "border-status-done-text/30 bg-status-done-bg text-status-done-text"
          : "border-border bg-surface-subtle text-ink-subtle",
      )}
    >
      <span
        className={clsx(
          "h-2 w-2 rounded-full",
          online ? "bg-status-done-text" : "bg-ink-subtle",
        )}
      />
      {online ? "Online" : "Offline"}
    </button>
  );
}
