"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

// Captures the beforeinstallprompt event and offers an Install button.
// Falls back to iOS "Add to Home Screen" instructions where the event
// isn't available.
interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) setInstalled(true);

    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } else if (isIos) {
      setShowIosHelp((s) => !s);
    }
  }

  // Only render if we can install (Chromium event) or on iOS (manual steps).
  if (!deferred && !isIos) return null;

  return (
    <div className="relative">
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg border border-primary px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-on-primary"
      >
        <Icon name="download" size={16} />
        <span className="hidden sm:inline">Install app</span>
      </button>
      {showIosHelp && (
        <div className="absolute right-0 top-9 z-50 w-60 rounded-lg border border-border bg-surface p-3 text-xs text-ink-muted shadow-lg">
          On iPhone/iPad: tap the <strong>Share</strong> icon, then{" "}
          <strong>Add to Home Screen</strong>.
        </div>
      )}
    </div>
  );
}
