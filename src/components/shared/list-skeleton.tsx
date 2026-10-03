"use client";

import { cn } from "@/lib/utils";

/**
 * ListSkeleton — shows a placeholder table-like layout while a list is
 * loading. Renders `rows` shimmering rows of the same shape as a typical
 * DataTable.
 */
export function ListSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white overflow-hidden",
        className
      )}
    >
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className="h-4 w-1/3 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-1/4 bg-slate-200 rounded animate-pulse hidden sm:block" />
            <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
            <div className="ml-auto h-8 w-24 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
