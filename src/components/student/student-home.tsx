"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, GraduationCap, Loader2, AlertTriangle, ListChecks, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import { ClassCard, type StudentClass } from "@/components/student/class-card";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * StudentHome — the polished landing/dashboard for students.
 *
 * Shows a "Ready to practice?" hero plus a grid of available classes
 * (only active classes, loaded from /api/student/academic).
 *
 * Clicking a class navigates the student into the academic drill-down:
 *   Class → Subjects → Topics → Quiz setup
 */
export function StudentHome({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [classes, setClasses] = useState<StudentClass[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/academic", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load classes");
        const data = (await res.json()) as { classes: StudentClass[] };
        if (cancelled) return;
        setClasses(data.classes);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load classes");
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

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3.5 py-1.5 text-xs font-medium mb-5"
          >
            <Sparkles className="size-3" />
            Welcome, {user.name.split(" ")[0]}
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Ready to practice?
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            Pick a class to start. Choose your subject, drill into a topic,
            and we&apos;ll handle the rest.
          </p>
        </motion.div>

        {/* Content */}
        {loading ? (
          <ClassesSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </div>
        ) : !classes || classes.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No classes available yet"
            description="Your administrator hasn't published any classes. Check back soon!"
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((klass, idx) => (
                <ClassCard
                  key={klass.id}
                  klass={klass}
                  index={idx}
                  onClick={() =>
                    setView({
                      name: "student-subjects",
                      classId: klass.id,
                    })
                  }
                />
              ))}
            </div>

            {/* Quiz sets link */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="mt-10"
            >
              <button
                type="button"
                onClick={() => setView({ name: "student-quiz-sets" })}
                className="w-full rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white flex items-center justify-center shadow-sm shadow-violet-500/20">
                      <ListChecks className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Browse quiz sets
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Pre-built collections curated by your instructor.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-slate-300" />
                </div>
              </button>
            </motion.div>
          </>
        )}
      </main>

      <footer className="border-t border-slate-200/60 py-6 mt-auto">
        <p className="text-center text-xs text-slate-400">
          Quizverse — practice MCQs the modern way
        </p>
      </footer>
    </div>
  );
}

function ClassesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-xl bg-slate-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
      <div className="col-span-full flex items-center justify-center text-xs text-slate-400 gap-2">
        <Loader2 className="size-3 animate-spin" />
        Loading available classes…
      </div>
    </div>
  );
}
