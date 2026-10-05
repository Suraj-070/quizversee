"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Loader2, ChevronRight, AlertTriangle, GraduationCap,
} from "lucide-react";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * MyLearning — the student's primary curriculum area.
 *
 * Shows subjects from the student's academic profile (selected during
 * onboarding). Each subject links to its curriculum topics.
 *
 * Content type = "curriculum" (admin-curated, trusted).
 */
type MySubject = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  class: { id: string; name: string };
  topicCount: number;
  questionCount: number;
};

export function MyLearning({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [className, setClassName] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<MySubject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/my-learning", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as { subjects: MySubject[]; className: string | null };
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }} className="mb-6">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
            {className ?? "Your class"} · Curriculum
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            My Learning
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Content curated for your studies. Pick a subject to start practicing.
          </p>
        </motion.div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="size-11 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-slate-200 rounded" />
                    <div className="h-3 w-32 bg-slate-200 rounded" />
                  </div>
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
            icon={GraduationCap}
            title="No subjects available yet"
            description="Your learning space is being prepared. Check back soon or update your subjects in Profile."
            action={
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setView({ name: "student-profile" })}>
                Update subjects
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {subjects.map((subject, idx) => (
              <motion.button
                key={subject.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setView({
                  name: "student-topics",
                  classId: subject.class.id,
                  subjectId: subject.id,
                })}
                className={cn(
                  "group text-left rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card",
                  "hover:shadow-card-hover hover:border-emerald-300 transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="size-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
                      <BookOpen className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{subject.name}</h3>
                      {subject.description && (
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{subject.description}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span>{subject.topicCount} topics</span>
                  <span>{subject.questionCount} questions</span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
