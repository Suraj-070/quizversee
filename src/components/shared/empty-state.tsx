"use client";

import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — friendly placeholder shown when a list has no rows.
 *
 * Use it for "No classes available", "This topic has no published questions",
 * etc. Always include a `title`; optionally include a `description` and a
 * CTA button (passed as `action`).
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center",
        className
      )}
    >
      <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center">
        <Icon className="size-6 text-slate-400" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
