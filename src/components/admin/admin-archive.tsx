"use client";

import { Archive as ArchiveIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export function AdminArchive() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Archive</h2>
        <p className="text-sm text-slate-600 mt-1">
          Archived content can be restored or permanently deleted here.
        </p>
      </div>
      <EmptyState
        icon={ArchiveIcon}
        title="Nothing archived yet"
        description="When you archive classes, subjects, topics, questions, or announcements, they'll appear here for restoration or permanent deletion."
      />
    </div>
  );
}
