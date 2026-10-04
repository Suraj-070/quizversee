"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import {
  SubjectCard,
  type StudentSubject,
} from "@/components/student/subject-card";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * StudentSubjects — list of subjects for a given class.
 *
 * Loaded from /api/student/subjects?classId=<id>. Only active subjects
 * with active topics and published questions are useful to the student,
 * but we show all active subjects and let the topic screen explain when
 * a topic has no questions yet.
 */
export function StudentSubjects({ user }: { user: PublicUser }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);

  const classId = view.name === "student-subjects" ? view.classId : "";

  const [klass, setKlass] = useState<{
    id: string;
    name: string;
    description: string | null;
  } | null>(null);
  const [subjects, setSubjects] = useState<StudentSubject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) {
      setView({ name: "student-home" });
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/student/subjects?classId=${classId}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("This class is no longer available.");
          }
          throw new Error("Failed to load subjects");
        }
        const data = (await res.json()) as {
          class: typeof klass;
          subjects: StudentSubject[];
        };
        if (cancelled) return;
        setKlass(data.class);
        setSubjects(data.subjects);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load subjects");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [classId, setView]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white flex flex-col">
      <StudentHeader user={user} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
            Class
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">
            {loading ? "Loading…" : klass?.name ?? "Class"}
          </h1>
          {klass?.description && (
            <p className="mt-2 text-slate-600">{klass.description}</p>
          )}
        </motion.div>

        {loading ? (
          <SubjectsSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setView({ name: "student-home" })}
            >
              Back to classes
            </Button>
          </div>
        ) : !subjects || subjects.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No subjects available"
            description="This class doesn't have any active subjects yet. Check back later."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView({ name: "student-home" })}
              >
                Back to classes
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject, idx) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                index={idx}
                onClick={() =>
                  setView({
                    name: "student-topics",
                    classId,
                    subjectId: subject.id,
                  })
                }
                onExam={() =>
                  setView({
                    name: "subject-quiz-setup",
                    subjectId: subject.id,
                  })
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SubjectsSkeleton() {
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
        Loading subjects…
      </div>
    </div>
  );
}
