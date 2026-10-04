"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ChevronLeft,
  Loader2,
  Sparkles,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * QuizReview — lets students review every question after completing
 * the quiz.
 *
 * Per PRD §28:
 *   For each question show:
 *     - Question text
 *     - Their answer
 *     - Correct answer
 *     - Correct / Incorrect indicator
 *     - Explanation (if available)
 */
type ReviewAnswer = {
  id: string;
  selectedOption: "A" | "B" | "C" | "D";
  isCorrect: boolean;
  question: {
    id: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: "A" | "B" | "C" | "D";
    explanation: string | null;
  };
};

type ReviewAttempt = {
  id: string;
  totalQuestions: number;
  correctAnswers: number;
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
  answers: ReviewAnswer[];
};

export function QuizReview({ user }: { user: PublicUser }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);

  const attemptId = view.name === "quiz-review" ? view.attemptId : "";

  const [attempt, setAttempt] = useState<ReviewAttempt | null>(null);
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
        const res = await fetch(
          `/api/student/attempts?attemptId=${attemptId}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error("Failed to load review");
        }
        const data = (await res.json()) as { attempt: ReviewAttempt };
        if (cancelled) return;
        setAttempt(data.attempt);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load review");
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
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">
              {error ?? "Failed to load review"}
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

  const scorePct = Math.round(attempt.scorePercentage);

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
            Review
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            {attempt.topic?.name ?? attempt.quizSet?.name ?? "Quiz"}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            You scored {attempt.correctAnswers}/{attempt.totalQuestions} (
            {scorePct}%)
          </p>
        </motion.div>

        <div className="space-y-4">
          {attempt.answers.map((ans, idx) => {
            const optionKeys: Array<"A" | "B" | "C" | "D"> = [
              "A",
              "B",
              "C",
              "D",
            ];
            const optionText: Record<"A" | "B" | "C" | "D", string> = {
              A: ans.question.optionA,
              B: ans.question.optionB,
              C: ans.question.optionC,
              D: ans.question.optionD,
            };

            return (
              <motion.div
                key={ans.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-2 mb-3">
                  <div
                    className={cn(
                      "size-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold",
                      ans.isCorrect
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    )}
                  >
                    {idx + 1}
                  </div>
                  <h3 className="font-medium text-slate-900 leading-relaxed">
                    {ans.question.questionText}
                  </h3>
                </div>

                {/* Options list */}
                <div className="space-y-2">
                  {optionKeys.map((k) => {
                    const isUserAnswer = ans.selectedOption === k;
                    const isCorrectAnswer =
                      ans.question.correctOption === k;

                    return (
                      <div
                        key={k}
                        className={cn(
                          "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                          isCorrectAnswer &&
                            "border-emerald-300 bg-emerald-50",
                          !isCorrectAnswer &&
                            isUserAnswer &&
                            "border-red-300 bg-red-50",
                          !isCorrectAnswer &&
                            !isUserAnswer &&
                            "border-slate-200 bg-white opacity-70"
                        )}
                      >
                        <div
                          className={cn(
                            "size-5 shrink-0 rounded flex items-center justify-center text-xs font-semibold mt-0.5",
                            isCorrectAnswer
                              ? "bg-emerald-500 text-white"
                              : isUserAnswer
                                ? "bg-red-500 text-white"
                                : "bg-slate-200 text-slate-600"
                          )}
                        >
                          {k}
                        </div>
                        <span className="flex-1 text-slate-900">
                          {optionText[k]}
                        </span>
                        {isCorrectAnswer && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="size-3.5" />
                            Correct answer
                          </span>
                        )}
                        {isUserAnswer && !isCorrectAnswer && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                            <XCircle className="size-3.5" />
                            Your answer
                          </span>
                        )}
                        {isUserAnswer && isCorrectAnswer && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="size-3.5" />
                            Your answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {ans.question.explanation && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
                    <Info className="size-4 text-slate-400 mt-0.5 shrink-0" />
                    <p>{ans.question.explanation}</p>
                  </div>
                )}

                {/* AI explanation button (only for wrong answers) */}
                {!ans.isCorrect && (
                  <AIExplanationButton
                    questionId={ans.question.id}
                    selectedOption={ans.selectedOption}
                  />
                )}

                {/* Flag toggle */}
                <FlagButton questionId={ans.question.id} />
              </motion.div>
            );
          })}
        </div>

        {/* Back button */}
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              if (attempt.topic) {
                setView({
                  name: "student-topics",
                  classId: attempt.topic.subject.class.id,
                  subjectId: attempt.topic.subject.id,
                });
              } else if (attempt.quizSet) {
                setView({ name: "student-quiz-sets" });
              } else {
                setView({ name: "student-home" });
              }
            }}
          >
            <ChevronLeft className="size-4" />
            {attempt.topic ? "Back to topics" : "Back to quiz sets"}
          </Button>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Explanation Button — generates an AI-powered explanation for wrong answers
// ---------------------------------------------------------------------------

function AIExplanationButton({
  questionId,
  selectedOption,
}: {
  questionId: string;
  selectedOption: "A" | "B" | "C" | "D";
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/student/questions/${questionId}/ai-explanation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedOption }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to generate explanation");
      }
      const data = await res.json();
      setExplanation(data.explanation);
      toast.success("AI explanation ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  if (explanation) {
    return (
      <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-slate-700">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles className="size-4 text-violet-500" />
          <span className="font-medium text-violet-700">AI explanation</span>
        </div>
        <p>{explanation}</p>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-3 text-violet-600 border-violet-300 hover:bg-violet-50 hover:text-violet-700"
      onClick={handleGenerate}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {loading ? "Generating…" : "Get AI explanation"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Flag Button — lets students bookmark a question for later review
// ---------------------------------------------------------------------------

function FlagButton({ questionId }: { questionId: string }) {
  const [flagged, setFlagged] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/student/questions/${questionId}/flag`)
      .then((r) => r.json())
      .then((d) => setFlagged(!!d.flagged))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [questionId]);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/student/questions/${questionId}/flag`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle");
      const d = await res.json();
      setFlagged(d.flagged);
    } catch {
      toast.error("Failed to toggle flag");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "mt-2",
        flagged
          ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          : "text-slate-400 hover:text-slate-600"
      )}
      onClick={toggle}
      disabled={loading}
    >
      <Flag className={cn("size-3.5", flagged && "fill-current")} />
      {flagged ? "Flagged for review" : "Flag for review"}
    </Button>
  );
}
