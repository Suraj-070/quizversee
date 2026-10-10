"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PlayCircle,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { useQuizSessionStore } from "@/stores/quiz-session-store";
import { StudentHeader } from "@/components/student/student-header";

/**
 * QuizSetSetup — simplified setup screen for quiz-set attempts.
 *
 * Unlike the topic-quiz setup, quiz sets don't have a count picker —
 * the student takes ALL questions in the set. So this screen just shows
 * the set name, question count, and a Start button.
 */
type QuizSetInfo = {
  id: string;
  name: string;
  description: string | null;
  class: { id: string; name: string };
  subject: { id: string; name: string } | null;
  _count: { questions: number };
};

export function QuizSetSetup({ user }: { user: PublicUser }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const goBack = useViewStore((s) => s.goBack);
  const startQuiz = useQuizSessionStore((s) => s.start);

  const quizSetId = view.name === "quiz-set-setup" ? view.quizSetId : "";

  const [quizSet, setQuizSet] = useState<QuizSetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!quizSetId) {
      setView({ name: "student-home" });
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Use the admin endpoint to fetch the set details (the student
        // doesn't have a dedicated "fetch one quiz set" endpoint, but
        // the admin endpoint will work for any authenticated user —
        // it just returns 403 if the user isn't an admin. Since quiz
        // sets are public content once published, we use the list
        // endpoint and filter.)
        const res = await fetch("/api/student/quiz-sets", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load quiz sets");
        const data = (await res.json()) as { quizSets: QuizSetInfo[] };
        if (cancelled) return;
        const found = data.quizSets.find((qs) => qs.id === quizSetId);
        if (!found) {
          throw new Error("This quiz set is no longer available.");
        }
        setQuizSet(found);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load quiz set");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [quizSetId, setView]);

  async function handleStart() {
    if (starting || !quizSet) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/student/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizSetId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to start quiz");
      }
      const data = (await res.json()) as {
        attemptId: string;
        questions: Array<{
          id: string;
          questionText: string;
          optionA: string;
          optionB: string;
          optionC: string;
          optionD: string;
          explanation: string | null;
          userAnswerId: string;
          questionImage: string | null;
          optionAImage: string | null;
          optionBImage: string | null;
          optionCImage: string | null;
          optionDImage: string | null;
        }>;
      };
      startQuiz(data.attemptId, data.questions, "immediate");
      setView({ name: "quiz-active", attemptId: data.attemptId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start quiz");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
            <span className="ml-2 text-sm text-slate-500">Loading quiz set…</span>
          </div>
        </main>
      </div>
    );
  }

  if (error || !quizSet) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">
              {error ?? "Failed to load quiz set"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={goBack}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
            Quiz Set
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">
            {quizSet.name}
          </h1>
          {quizSet.description && (
            <p className="mt-2 text-slate-600">{quizSet.description}</p>
          )}

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ListChecks className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {quizSet._count.questions}{" "}
                  {quizSet._count.questions === 1 ? "question" : "questions"} in
                  this set
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  You&apos;ll take all of them in one go, in random order.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Button
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={starting}
              onClick={handleStart}
            >
              {starting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <PlayCircle className="size-5" />
                  Start Quiz Set ({quizSet._count.questions} questions)
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
