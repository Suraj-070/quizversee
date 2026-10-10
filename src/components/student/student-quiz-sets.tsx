"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ListChecks,
  AlertTriangle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

/**
 * StudentQuizSets — list of published quiz sets the student can take.
 *
 * Per PRD §12: students can take a quiz set (which uses ALL its questions,
 * no count picker) instead of a topic quiz.
 *
 * Clicking a set navigates to quiz-set-setup (a simplified version of
 * quiz-setup that shows the set name + question count + Start button,
 * skipping the count picker).
 */
type QuizSetSummary = {
  id: string;
  name: string;
  description: string | null;
  class: { id: string; name: string };
  subject: { id: string; name: string } | null;
  _count: { questions: number };
};

export function StudentQuizSets({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [quizSets, setQuizSets] = useState<QuizSetSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/quiz-sets", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load quiz sets");
        const data = (await res.json()) as { quizSets: QuizSetSummary[] };
        if (cancelled) return;
        setQuizSets(data.quizSets);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load quiz sets");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
            Curated practice
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">
            Quiz Sets
          </h1>
          <p className="text-slate-600 mt-2">
            Pre-built collections of questions. Take the whole set in one go.
          </p>
        </motion.div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="size-11 rounded-xl bg-slate-200 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
            <div className="col-span-full flex items-center justify-center text-xs text-slate-400 gap-2">
              <Loader2 className="size-3 animate-spin" />
              Loading quiz sets…
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        ) : !quizSets || quizSets.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No quiz sets available"
            description="Your administrator hasn't published any quiz sets yet. Check back later, or take a topic quiz instead."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizSets.map((qs, idx) => (
              <motion.button
                key={qs.id}
                type="button"
                onClick={() =>
                  setView({ name: "quiz-set-setup", quizSetId: qs.id })
                }
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                className={cn(
                  "group w-full text-left",
                  "rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm",
                  "hover:shadow-md hover:border-emerald-300 transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-11 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white flex items-center justify-center shadow-sm shadow-violet-500/20">
                      <ListChecks className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                        {qs.name}
                      </h3>
                      {qs.description && (
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                          {qs.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>

                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                  <span>{qs.class.name}</span>
                  {qs.subject && (
                    <>
                      <span>·</span>
                      <span>{qs.subject.name}</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="font-medium text-slate-700">
                    {qs._count.questions}{" "}
                    {qs._count.questions === 1 ? "question" : "questions"}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
