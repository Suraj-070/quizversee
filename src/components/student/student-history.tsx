"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  History,
  AlertTriangle,
  Loader2,
  Trophy,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

/**
 * StudentHistory — list of the user's past quiz attempts.
 *
 * Per PRD §29:
 *   Show recent attempts with:
 *     - Subject (Class)
 *     - Topic
 *     - Score (e.g. 24/30)
 *     - Percentage
 *
 * No advanced analytics required.
 */
type HistoryAttempt = {
  id: string;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  startedAt: string;
  completedAt: string | null;
  topic: {
    id: string;
    name: string;
    subject: {
      id: string;
      name: string;
      class: { id: string; name: string };
    };
  } | null;
  quizSet: {
    id: string;
    name: string;
    class: { id: string; name: string };
    subject: { id: string; name: string } | null;
  } | null;
};

export function StudentHistory({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [attempts, setAttempts] = useState<HistoryAttempt[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/attempts", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load history");
        const data = (await res.json()) as { attempts: HistoryAttempt[] };
        if (cancelled) return;
        setAttempts(data.attempts);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = (attempts ?? []).filter((a) => a.completedAt);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
            Your activity
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Recent attempts
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            A log of every quiz you&apos;ve taken.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-slate-200 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-center text-xs text-slate-400 gap-2">
              <Loader2 className="size-3 animate-spin" />
              Loading history…
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        ) : completed.length === 0 ? (
          <EmptyState
            icon={History}
            title="No attempts yet"
            description="Take your first quiz to see your history here."
            action={
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setView({ name: "student-home" })}
              >
                Browse classes
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {completed.map((a, idx) => {
              const pct = Math.round(a.scorePercentage);
              const isGood = pct >= 70;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(idx * 0.03, 0.3),
                  }}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "size-11 shrink-0 rounded-lg flex items-center justify-center",
                        isGood
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      <Trophy className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {a.topic?.name ?? a.quizSet?.name ?? "Quiz"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {a.topic
                          ? `${a.topic.subject.class.name} · ${a.topic.subject.name}`
                          : a.quizSet
                            ? `${a.quizSet.class.name}${a.quizSet.subject ? ` · ${a.quizSet.subject.name}` : ""}`
                            : ""}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(a.completedAt!).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "text-lg font-bold",
                          isGood ? "text-emerald-600" : "text-amber-600"
                        )}
                      >
                        {a.correctAnswers}/{a.totalQuestions}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-medium",
                          isGood ? "text-emerald-700" : "text-amber-700"
                        )}
                      >
                        {pct}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-600 hover:text-emerald-700"
                      onClick={() =>
                        setView({ name: "quiz-review", attemptId: a.id })
                      }
                    >
                      <ListChecks className="size-3.5" />
                      Review answers
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
