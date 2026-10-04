"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Flag,
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
 * StudentFlagged — list of questions the student has flagged for review.
 *
 * Each card shows the question text, topic breadcrumb, and a "Start
 * a quiz on this topic" link.
 */
type FlaggedQuestion = {
  id: string;
  question: {
    id: string;
    questionText: string;
    status: string;
    topic: {
      id: string;
      name: string;
      subject: {
        id: string;
        name: string;
        class: { id: string; name: string };
      };
    };
  };
};

export function StudentFlagged({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [flags, setFlags] = useState<FlaggedQuestion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/questions/flagged", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load flagged questions");
        const data = (await res.json()) as { flags: FlaggedQuestion[] };
        if (cancelled) return;
        setFlags(data.flags);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
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
            Your bookmarks
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Flagged questions
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Questions you&apos;ve marked for later review.
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
                    <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-center text-xs text-slate-400 gap-2">
              <Loader2 className="size-3 animate-spin" />
              Loading flagged questions…
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        ) : !flags || flags.length === 0 ? (
          <EmptyState
            icon={Flag}
            title="No flagged questions yet"
            description="During a quiz, tap the flag icon on any question to bookmark it for later review."
          />
        ) : (
          <div className="space-y-3">
            {flags.map((flag, idx) => (
              <motion.div
                key={flag.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(idx * 0.03, 0.3),
                }}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 shrink-0 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Flag className="size-5 fill-current" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 line-clamp-2">
                      {flag.question.questionText}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {flag.question.topic.subject.class.name} ·{" "}
                      {flag.question.topic.subject.name} ·{" "}
                      {flag.question.topic.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setView({
                        name: "quiz-setup",
                        topicId: flag.question.topic.id,
                      })
                    }
                    className="shrink-0 text-emerald-600 hover:text-emerald-700 text-xs font-medium flex items-center gap-1"
                  >
                    Practice
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
