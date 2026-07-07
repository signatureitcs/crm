"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";

export function ProjectTabs({
  projectId,
  isManager,
}: {
  projectId: string;
  isManager?: boolean;
}) {
  const pathname = usePathname();
  const base = `/dashboard/project/${projectId}`;
  const tabs = [
    { label: "Workspace", href: base },
    { label: "Assets", href: `${base}/assets` },
    { label: "Sitelinks", href: `${base}/sitelinks` },
    { label: "Notes", href: `${base}/notes` },
    { label: "Search console", href: `${base}/search-console` },
    ...(isManager ? [{ label: "Settings", href: `${base}/settings` }] : []),
  ];

  return (
    <nav className="-mx-4 flex gap-5 overflow-x-auto px-4 md:mx-0 md:gap-6 md:px-0">
      {tabs.map((tab) => {
        const active =
          tab.href === base
            ? pathname === base
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "flex h-12 shrink-0 items-center whitespace-nowrap border-b-2 text-sm transition-colors",
              active
                ? "border-primary font-medium text-primary"
                : "border-transparent text-ink-muted hover:text-primary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
