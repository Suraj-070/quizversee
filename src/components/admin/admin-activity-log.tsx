"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { cn } from "@/lib/utils";

type Activity = {
  id: string; action: string; entity: string; description: string;
  createdAt: string; admin: { name: string } | null;
};

export function AdminActivityLog() {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/activity", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { activities: Activity[] };
        setItems(data.activities);
      } catch { setItems([]); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const actionColors: Record<string, string> = {
    created: "bg-emerald-100 text-emerald-700",
    published: "bg-sky-100 text-sky-700",
    archived: "bg-amber-100 text-amber-700",
    imported: "bg-violet-100 text-violet-700",
    edited: "bg-slate-100 text-slate-600",
    changed: "bg-slate-100 text-slate-600",
    restored: "bg-emerald-100 text-emerald-700",
    unpublished: "bg-amber-100 text-amber-700",
  };

  function getActionTone(action: string): string {
    for (const [key, color] of Object.entries(actionColors)) {
      if (action.includes(key)) return color;
    }
    return "bg-slate-100 text-slate-600";
  }

  if (loading) return <ListSkeleton rows={5} />;
  if (!items || items.length === 0) {
    return <EmptyState icon={History} title="No activity yet" description="Admin actions will appear here." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Activity Log</h2>
        <p className="text-sm text-slate-600 mt-1">Recent admin actions across the platform.</p>
      </div>

      <div className="space-y-2">
        {items.map((a, idx) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm flex items-center gap-3"
          >
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider", getActionTone(a.action))}>
              {a.action.split(".").pop()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-900">{a.description}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {a.admin?.name ?? "System"} · {new Date(a.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
