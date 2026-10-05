"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Dumbbell, Loader2, ChevronRight, AlertTriangle, BookOpen, Sparkles,
} from "lucide-react";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ExtraPractice — additional questions to strengthen understanding.
 *
 * Shows extra practice topics (contentType = "extra_practice") for the
 * student's selected subjects. Uses the SAME quiz engine as My Learning.
 *
 * Content type = "extra_practice" (external/imported, supplementary).
 */
type PracticeSubject = {
  id: string;
  name: string;
  icon: string | null;
  topics: Array<{
    id: string;
    name: string;
    description: string | null;
    questionCount: number;
  }>;
};

export function ExtraPractice({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [className, setClassName] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<PracticeSubject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/extra-practice", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as { subjects: PracticeSubject[]; className: string | null };
        if (cancelled) return;
        setSubjects(data.subjects);
        setClassName(data.className);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }} className="mb-6">
          <p className="text-xs font-medium text-violet-600 uppercase tracking-wider">
            {className ?? "Your class"} · Supplementary
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Extra Practice
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Additional questions to strengthen your understanding.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
                <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-slate-200 rounded" />
                  <div className="h-3 w-3/4 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : !subjects || subjects.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="More practice is coming soon"
            description="We're preparing additional practice questions for your subjects. Check back later!"
            action={
              <Button size="sm" variant="outline" onClick={() => setView({ name: "explore" })}>
                <Sparkles className="size-4" />
                Explore other topics
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {subjects.map((subject, sIdx) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sIdx * 0.1, duration: 0.2 }}
              >
                <h2 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <BookOpen className="size-4 text-violet-500" />
                  {subject.name}
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {subject.topics.map((topic, tIdx) => (
                    <motion.button
                      key={topic.id}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: sIdx * 0.1 + tIdx * 0.03 }}
                      whileHover={{ y: -1 }}
                      onClick={() => setView({ name: "quiz-setup", topicId: topic.id })}
                      className={cn(
                        "text-left rounded-xl border border-slate-200 bg-white p-4 transition-all",
                        "hover:border-violet-300 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm">{topic.name}</p>
                          {topic.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{topic.description}</p>
                          )}
                          <p className="text-xs text-violet-600 mt-1">{topic.questionCount} questions</p>
                        </div>
                        <ChevronRight className="size-4 text-slate-300 shrink-0" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
