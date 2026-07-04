"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "@/components/icon";

// Submit button that disables itself and shows a spinner while the parent
// <form action={...}> server action is pending — prevents double submits.
export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && (
        <Icon name="progress_activity" size={18} className="animate-spin" />
      )}
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}
