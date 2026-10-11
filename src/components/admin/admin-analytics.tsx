"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Target, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Analytics = {
  overview: { totalAttempts: number; totalUsers: number; avgScore: number };
  topTopics: Array<{ topicId: string; topicName: string; subjectName: string; attempts: number; avgScore: number }>;
  hardestQuestions: Array<{ questionId: string; questionText: string; topicName: string; attempts: number; correctRate: number; difficulty: string }>;
  easiestQuestions: Array<{ questionId: string; questionText: string; topicName: string; attempts: number; correctRate: number; difficulty: string }>;
};

export function AdminAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/analytics", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load analytics");
        const d = (await res.json()) as Analytics;
        if (!cancelled) setData(d);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [retry]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-800">Analytics are temporarily unavailable.</p>
        <p className="mt-1 text-xs text-slate-500">{error ?? "No data returned."}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setRetry((value) => value + 1)}>Try again</Button>
      </div>
    );
  }

  const difficultyColor = (d: string) =>
    d === "Easy" ? "text-emerald-600" : d === "Medium" ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
        <p className="text-sm text-slate-600 mt-1">Real performance insights from completed quiz attempts.</p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-3 gap-4">
        <OverviewCard icon={TrendingUp} label="Total Attempts" value={data.overview.totalAttempts} color="sky" />
        <OverviewCard icon={Target} label="Students" value={data.overview.totalUsers} color="violet" />
        <OverviewCard icon={Award} label="Avg Score" value={`${data.overview.avgScore}%`} color="emerald" />
      </div>

      {/* Most attempted topics */}
      {data.topTopics.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-3">Most Attempted Topics</h3>
          <div className="space-y-2">
            {data.topTopics.map((t, i) => (
              <div key={t.topicId} className="rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-4">
                <span className="text-sm font-bold text-slate-400 w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{t.topicName}</p>
                  <p className="text-xs text-slate-500">{t.subjectName} · {t.attempts} attempts</p>
                </div>
                <div className="text-right">
                  <span className={cn("text-sm font-bold", t.avgScore >= 70 ? "text-emerald-600" : t.avgScore >= 40 ? "text-amber-600" : "text-red-600")}>
                    {t.avgScore}%
                  </span>
                  <p className="text-[10px] text-slate-400">avg score</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Question rankings require at least five appearances in completed quizzes. Skipped questions may count as incorrect in older attempts.
      </p>

      {/* Hardest / Easiest questions */}
      {data.hardestQuestions.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Hardest Questions</h3>
            <div className="space-y-2">
              {data.hardestQuestions.slice(0, 5).map((q) => (
                <div key={q.questionId} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-900 line-clamp-2">{q.questionText}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className={cn("font-medium", difficultyColor(q.difficulty))}>{q.difficulty}</span>
                    <span className="text-slate-500">{q.correctRate}% correct</span>
                    <span className="text-slate-400">{q.attempts} attempts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-3">Easiest Questions</h3>
            <div className="space-y-2">
              {data.easiestQuestions.slice(0, 5).map((q) => (
                <div key={q.questionId} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-900 line-clamp-2">{q.questionText}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className={cn("font-medium", difficultyColor(q.difficulty))}>{q.difficulty}</span>
                    <span className="text-slate-500">{q.correctRate}% correct</span>
                    <span className="text-slate-400">{q.attempts} attempts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data.topTopics.length === 0 && data.hardestQuestions.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <BarChart3 className="size-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No analytics data yet. Data appears after students take quizzes.</p>
        </div>
      )}
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
};

function OverviewCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
        </div>
        <div className={cn("size-9 rounded-lg flex items-center justify-center", COLOR_MAP[color])}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}
