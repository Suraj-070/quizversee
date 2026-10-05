"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList, RefreshCw, Loader2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { useViewStore } from "@/stores/view-store";
import { cn } from "@/lib/utils";

type Attempt = {
  id: string;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  completedAt: string;
  user: { id: string; name: string; email: string };
  topic: { id: string; name: string; subject: { name: string; class: { id: string; name: string } } } | null;
  subject: { id: string; name: string; class: { id: string; name: string } } | null;
  quizSet: { id: string; name: string } | null;
};

export function AdminAttempts() {
  const setView = useViewStore((s) => s.setView);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/attempts", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { attempts: Attempt[] };
      setAttempts(data.attempts);
    } catch { setAttempts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = (attempts ?? []).filter((a) =>
    a.user.name.toLowerCase().includes(search.toLowerCase()) ||
    a.user.email.toLowerCase().includes(search.toLowerCase()) ||
    (a.topic?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quiz Attempts</h2>
          <p className="text-sm text-slate-600 mt-1">All student quiz attempts across the platform.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      {attempts && attempts.length > 0 && (
        <Input
          placeholder="Search by student or topic…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : !attempts || attempts.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No attempts yet" description="Student quiz attempts will appear here." />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Student</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Topic / Subject</th>
                  <th className="px-4 py-3 text-left font-medium">Score</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">%</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((a, idx) => (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
                    className="hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => setView({ name: "admin-user-detail", userId: a.user.id })}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {a.user.name}
                      <span className="block text-xs text-slate-400 font-normal">{a.user.email}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                      {a.topic?.name ?? a.quizSet?.name ?? a.subject?.name ?? "Quiz"}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      {a.correctAnswers}/{a.totalQuestions}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn("font-medium", a.scorePercentage >= 70 ? "text-emerald-600" : a.scorePercentage >= 40 ? "text-amber-600" : "text-red-600")}>
                        {Math.round(a.scorePercentage)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                      {new Date(a.completedAt!).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="size-4 text-slate-300 inline" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
