"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ListChecks,
  ChevronLeft,
  Trophy,
  Loader2,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { useQuizSessionStore } from "@/stores/quiz-session-store";
import { StudentHeader } from "@/components/student/student-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * QuizResults — the completion screen.
 *
 * Per PRD §27:
 *   - "Quiz Complete" + topic name
 *   - Score: X / Total (80%)
 *   - Correct: N, Incorrect: M
 *   - Buttons: Review Answers / Try Again / Back to Topics
 *
 * The score is finalized server-side via POST /api/student/attempts/[id]/complete
 * (called from QuizActive). This screen fetches the attempt to display
 * the final score, with a "satisfying but subtle" completion animation.
 */
export function QuizResults({ user }: { user: PublicUser }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const clearSession = useQuizSessionStore((s) => s.clear);
  const startQuiz = useQuizSessionStore((s) => s.start);
  const [practicingWrong, setPracticingWrong] = useState(false);

  const attemptId = view.name === "quiz-results" ? view.attemptId : "";

  const [result, setResult] = useState<{
    attemptId: string;
    correctAnswers: number;
    totalQuestions: number;
    scorePercentage: number;
    completedAt: string;
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
    subject: {
      id: string;
      name: string;
      class: { id: string; name: string };
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) {
      setView({ name: "student-home" });
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // The attempt is already marked complete from QuizActive. Just fetch it.
        const res = await fetch(
          `/api/student/attempts?attemptId=${attemptId}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error("Failed to load quiz results");
        }
        const data = (await res.json()) as {
          attempt: {
            id: string;
            correctAnswers: number;
            totalQuestions: number;
            scorePercentage: number;
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
            subject: {
              id: string;
              name: string;
              class: { id: string; name: string };
            } | null;
          };
        };
        if (cancelled) return;
        if (!data.attempt.completedAt) {
          // Incomplete — shouldn't happen, but handle gracefully
          throw new Error("This quiz attempt has not been completed yet.");
        }
        setResult({
          attemptId: data.attempt.id,
          correctAnswers: data.attempt.correctAnswers,
          totalQuestions: data.attempt.totalQuestions,
          scorePercentage: data.attempt.scorePercentage,
          completedAt: data.attempt.completedAt,
          topic: data.attempt.topic,
          quizSet: data.attempt.quizSet,
          subject: data.attempt.subject,
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load results");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [attemptId, setView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">
              {error ?? "Failed to load results"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setView({ name: "student-home" })}
            >
              Back to home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const incorrect = result.totalQuestions - result.correctAnswers;
  const scorePct = Math.round(result.scorePercentage);
  const isGoodScore = scorePct >= 70;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.1,
            }}
            className={cn(
              "mx-auto size-20 rounded-3xl flex items-center justify-center shadow-lg",
              isGoodScore
                ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-emerald-500/30"
                : "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/30"
            )}
          >
            <Trophy className="size-10" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 text-3xl font-bold tracking-tight text-slate-900"
          >
            Quiz Complete
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-1 text-slate-600"
          >
            {result.topic?.name ?? result.quizSet?.name ?? result.subject?.name ?? "Quiz"}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card"
        >
          {/* Big score */}
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-2">
              <span
                className={cn(
                  "text-5xl sm:text-6xl font-bold tracking-tight",
                  isGoodScore ? "text-emerald-600" : "text-amber-600"
                )}
              >
                {result.correctAnswers}
              </span>
              <span className="text-2xl text-slate-400 font-medium">
                / {result.totalQuestions}
              </span>
            </div>
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold",
                isGoodScore
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              )}
            >
              {scorePct}%
            </div>
          </div>

          {/* Correct / Incorrect breakdown */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">
                  Correct
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {result.correctAnswers}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-red-200 bg-red-50 p-4"
            >
              <div className="flex items-center gap-2">
                <XCircle className="size-5 text-red-600" />
                <span className="text-sm font-medium text-red-700">
                  Incorrect
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-red-700">{incorrect}</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex flex-col sm:flex-row gap-3"
        >
          <Button
            variant="outline"
            className="flex-1"
            onClick={() =>
              setView({ name: "quiz-review", attemptId: result.attemptId })
            }
          >
            <ListChecks className="size-4" />
            Review answers
          </Button>
          {/* Practice Wrong Answers — only show if there are wrong answers */}
          {result.correctAnswers < result.totalQuestions && (
            <Button
              variant="outline"
              className="flex-1 border-violet-300 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
              disabled={practicingWrong}
              onClick={async () => {
                setPracticingWrong(true);
                try {
                  const res = await fetch("/api/student/attempts/practice-wrong", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fromAttemptId: result.attemptId }),
                  });
                  if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.error ?? "Failed to start practice");
                  }
                  const data = (await res.json()) as {
                    attemptId: string;
                    questions: Array<{
                      id: string; questionText: string;
                      optionA: string; optionB: string; optionC: string; optionD: string;
                      explanation: string | null;
                      userAnswerId: string;
                      questionImage: string | null;
                      optionAImage: string | null; optionBImage: string | null;
                      optionCImage: string | null; optionDImage: string | null;
                    }>;
                  };
                  startQuiz(data.attemptId, data.questions, "immediate");
                  setView({ name: "quiz-active", attemptId: data.attemptId });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to start practice");
                } finally {
                  setPracticingWrong(false);
                }
              }}
            >
              {practicingWrong ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Target className="size-4" />
              )}
              Practice {result.totalQuestions - result.correctAnswers} wrong
            </Button>
          )}
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => {
              clearSession();
              if (result.topic) {
                setView({ name: "quiz-setup", topicId: result.topic.id });
              } else if (result.quizSet) {
                setView({
                  name: "quiz-set-setup",
                  quizSetId: result.quizSet.id,
                });
              } else if (result.subject) {
                setView({
                  name: "subject-quiz-setup",
                  subjectId: result.subject.id,
                });
              } else {
                setView({ name: "student-home" });
              }
            }}
          >
            <RefreshCw className="size-4" />
            Try again
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              clearSession();
              if (result.topic) {
                setView({
                  name: "student-topics",
                  classId: result.topic.subject.class.id,
                  subjectId: result.topic.subject.id,
                });
              } else if (result.quizSet) {
                setView({ name: "student-quiz-sets" });
              } else if (result.subject) {
                setView({
                  name: "student-subjects",
                  classId: result.subject.class.id,
                });
              } else {
                setView({ name: "student-home" });
              }
            }}
          >
            <ChevronLeft className="size-4" />
            {result.topic
              ? "Back to topics"
              : result.subject
                ? "Back to subjects"
                : "Back to quiz sets"}
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
