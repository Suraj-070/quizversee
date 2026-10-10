"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Award, Target, Loader2, ChevronRight,
} from "lucide-react";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

type SubjectProgress = {
  subjectId: string; subjectName: string;
  classId: string; className: string;
  topics: Array<{
    topicId: string; topicName: string;
    attempts: number; bestScore: number; avgScore: number;
    lastAttemptDate: string;
  }>;
};

type ProgressData = {
  overview: { quizzesCompleted: number; avgScore: number; bestScore: number };
  subjects: SubjectProgress[];
  recentlyPracticed: Array<{
    attemptId: string; topicName: string; subjectName: string;
    score: number; total: number; percentage: number; date: string;
  }>;
};

export function StudentProgress({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/student/progress", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const d = (await res.json()) as ProgressData;
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
          </div>
        </main>
      </div>
    );
  }

  if (!data || data.overview.quizzesCompleted === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
          <EmptyState
            icon={TrendingUp}
            title="No progress yet"
            description="Take your first quiz to start tracking your progress."
            action={
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setView({ name: "student-home" })}>
                Start learning
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }} className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            My Progress
          </h1>
        </motion.div>

        {/* Overview */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatBox icon={Target} label="Completed" value={data.overview.quizzesCompleted} color="sky" />
          <StatBox icon={TrendingUp} label="Avg Score" value={`${data.overview.avgScore}%`} color="emerald" />
          <StatBox icon={Award} label="Best Score" value={`${data.overview.bestScore}%`} color="amber" />
        </div>

        {/* Progress by subject → topic */}
        <div className="space-y-6">
          {data.subjects.map((subj) => (
            <div key={subj.subjectId}>
              <h2 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                {subj.subjectName}
                <span className="text-xs text-slate-400 font-normal">
                  {subj.className}
                </span>
              </h2>
              <div className="space-y-2">
                {subj.topics.map((t) => (
                  <button
                    key={t.topicId}
                    type="button"
                    onClick={() => setView({ name: "quiz-setup", topicId: t.topicId })}
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-3 hover:shadow-sm transition-shadow text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.topicName}</p>
                      <p className="text-xs text-slate-500">
                        {t.attempts} {t.attempts === 1 ? "attempt" : "attempts"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-sm font-bold",
                        t.bestScore >= 70 ? "text-emerald-600" :
                        t.bestScore >= 40 ? "text-amber-600" : "text-red-600"
                      )}>
                        Best: {t.bestScore}%
                      </p>
                      <p className="text-xs text-slate-400">Avg: {t.avgScore}%</p>
                    </div>
                    <ChevronRight className="size-4 text-slate-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  amber: "bg-amber-100 text-amber-700",
};

function StatBox({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={cn("size-8 rounded-lg flex items-center justify-center mb-2", COLOR_MAP[color])}>
        <Icon className="size-4" />
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// Need to import Button
import { Button } from "@/components/ui/button";
