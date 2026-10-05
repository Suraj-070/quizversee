"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Layers, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import {
  TopicCard,
  type StudentTopic,
} from "@/components/student/topic-card";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * StudentTopics — list of topics for a given subject.
 *
 * Each topic shows:
 *   - published-question count
 *   - last attempt score (if any)
 *
 * Clicking a topic navigates to the quiz-setup screen (Phase 5).
 */
export function StudentTopics({ user }: { user: PublicUser }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);

  const subjectId =
    view.name === "student-topics" ? view.subjectId : "";

  const [subject, setSubject] = useState<{
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    class: { id: string; name: string };
  } | null>(null);
  const [topics, setTopics] = useState<StudentTopic[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId) {
      setView({ name: "student-home" });
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/student/topics?subjectId=${subjectId}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("This subject is no longer available.");
          }
          throw new Error("Failed to load topics");
        }
        const data = (await res.json()) as {
          subject: typeof subject;
          topics: StudentTopic[];
        };
        if (cancelled) return;
        setSubject(data.subject);
        setTopics(data.topics);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load topics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [subjectId, setView]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={user} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
            {loading
              ? "Loading…"
              : subject?.class.name
                ? `${subject.class.name} → Subject`
                : "Subject"}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">
            {loading ? "Loading…" : subject?.name ?? "Subject"}
          </h1>
          {subject?.description && (
            <p className="mt-2 text-slate-600">{subject.description}</p>
          )}
        </motion.div>

        {loading ? (
          <TopicsSkeleton />
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
        ) : !topics || topics.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No topics available"
            description="This subject doesn't have any active topics yet. Check back later."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.history.back()}
              >
                Back to subjects
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic, idx) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                index={idx}
                onClick={() =>
                  setView({ name: "quiz-setup", topicId: topic.id })
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TopicsSkeleton() {
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
              <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
      <div className="col-span-full flex items-center justify-center text-xs text-slate-400 gap-2">
        <Loader2 className="size-3 animate-spin" />
        Loading topics…
      </div>
    </div>
  );
}
