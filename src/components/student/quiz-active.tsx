"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  XCircle,
  Flag,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { useQuizSessionStore, type AnswerResult } from "@/stores/quiz-session-store";
import { StudentHeader } from "@/components/student/student-header";
import { cn } from "@/lib/utils";

/**
 * QuizActive — the actual quiz-taking screen.
 *
 * Per PRD §22 (Quiz Experience):
 *   - Display ONE question at a time
 *   - "Question X of Total" + progress bar
 *   - Large answer cards
 *
 * Per PRD §25 (Answer Behavior):
 *   - Show selected state
 *   - After confirming: correct → positive feedback, wrong → incorrect
 *     feedback + show correct answer
 *   - If explanation exists, show it after answering
 *   - Then show "Next Question" button (don't auto-advance)
 *
 * Per PRD §26 (Quiz Progress):
 *   - "Question X / Total" + progress bar
 *   - Optional "Answered: N  Remaining: M"
 *
 * The active quiz session is persisted in the quiz-session-store so that
 * a page refresh restores the user to the same question.
 */
export function QuizActive({ user }: { user: PublicUser }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const attemptId = useQuizSessionStore((s) => s.attemptId);
  const questions = useQuizSessionStore((s) => s.questions);
  const currentIndex = useQuizSessionStore((s) => s.currentIndex);
  const answers = useQuizSessionStore((s) => s.answers);
  const feedbackMode = useQuizSessionStore((s) => s.feedbackMode);
  const setCurrentIndex = useQuizSessionStore((s) => s.setCurrentIndex);
  const recordAnswer = useQuizSessionStore((s) => s.recordAnswer);

  const [selectedOption, setSelectedOption] = useState<
    "A" | "B" | "C" | "D" | null
  >(null);
  const [revealed, setRevealed] = useState(false);
  const [revealedResult, setRevealedResult] = useState<AnswerResult | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [flagToggling, setFlagToggling] = useState(false);

  const isExamMode = feedbackMode === "exam";

  // Reset local state when the question changes
  useEffect(() => {
    const q = questions[currentIndex];
    if (!q) return;
    const existing = answers[q.id];
    if (existing) {
      setSelectedOption(existing.selectedOption);
      if (isExamMode) {
        setRevealed(false);
        setRevealedResult(null);
      } else {
        setRevealed(true);
        setRevealedResult(existing);
      }
    } else {
      setSelectedOption(null);
      setRevealed(false);
      setRevealedResult(null);
    }
    setError(null);

    // Fetch flag status for this question
    setFlagged(false);
    fetch(`/api/student/questions/${q.id}/flag`)
      .then((r) => r.json())
      .then((d) => setFlagged(!!d.flagged))
      .catch(() => {});
  }, [currentIndex, questions, answers, isExamMode]);

  async function toggleFlag() {
    const q = questions[currentIndex];
    if (!q || flagToggling) return;
    setFlagToggling(true);
    try {
      const res = await fetch(`/api/student/questions/${q.id}/flag`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle flag");
      const data = await res.json();
      setFlagged(data.flagged);
    } catch {
      // ignore
    } finally {
      setFlagToggling(false);
    }
  }

  // Validate session
  if (
    view.name !== "quiz-active" ||
    !attemptId ||
    questions.length === 0 ||
    currentIndex >= questions.length
  ) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm font-medium text-amber-800">
              This quiz session is no longer active.
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

  const question = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const remaining = totalQuestions - answeredCount;
  const progressValue = (answeredCount / totalQuestions) * 100;

  async function handleReveal() {
    if (!selectedOption || submitting || revealed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/student/attempts/${attemptId}/answer`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAnswerId: question.userAnswerId,
            selectedOption,
            // In exam mode, don't ask the server to reveal the answer.
            reveal: !isExamMode,
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to submit answer");
      }

      if (isExamMode) {
        // Exam mode: server returned { recorded: true } only.
        // Store a partial answer (no correctness info) so the session
        // knows this question was answered.
        recordAnswer(question.id, {
          selectedOption,
          isCorrect: null,
          correctOption: null,
          explanation: null,
        });
        // Advance immediately — no feedback panel in exam mode.
        handleNext();
      } else {
        // Immediate mode: server returned { isCorrect, correctOption, explanation }.
        const data = (await res.json()) as AnswerResult;
        recordAnswer(question.id, data);
        setRevealedResult(data);
        setRevealed(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Last question → go to results
      handleComplete();
    }
  }

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/student/attempts/${attemptId}/complete`,
        { method: "POST" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to complete quiz");
      }
      setView({ name: "quiz-results", attemptId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete quiz");
    } finally {
      setSubmitting(false);
    }
  }

  const options: Array<{
    key: "A" | "B" | "C" | "D";
    text: string;
    image: string | null;
  }> = [
    { key: "A", text: question.optionA, image: question.optionAImage ?? null },
    { key: "B", text: question.optionB, image: question.optionBImage ?? null },
    { key: "C", text: question.optionC, image: question.optionCImage ?? null },
    { key: "D", text: question.optionD, image: question.optionDImage ?? null },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <StudentHeader user={user} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">
        {/* Progress header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-700">
                Question {currentIndex + 1}{" "}
                <span className="text-slate-400">/ {totalQuestions}</span>
              </p>
              {isExamMode && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  Exam mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Answered: {answeredCount} · Remaining: {remaining}
            </p>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Question */}
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 leading-relaxed flex-1">
                {question.questionText}
              </h1>
              <button
                type="button"
                onClick={toggleFlag}
                disabled={flagToggling}
                className={cn(
                  "shrink-0 size-9 rounded-lg flex items-center justify-center transition-colors",
                  flagged
                    ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                )}
                title={flagged ? "Unflag this question" : "Flag for review later"}
              >
                <Flag className={cn("size-4", flagged && "fill-current")} />
              </button>
            </div>

            {/* Optional question image (diagram, graph, figure) */}
            {question.questionImage && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <img
                  src={question.questionImage}
                  alt="Question figure"
                  className="max-h-64 w-auto mx-auto rounded"
                />
              </div>
            )}

            {/* Options */}
            <div className="mt-6 space-y-3">
              {options.map((opt) => {
                const isSelected = selectedOption === opt.key;
                const isCorrect =
                  revealed &&
                  revealedResult?.correctOption === opt.key;
                const isWrongSelected =
                  revealed && isSelected && !revealedResult?.isCorrect;

                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => !revealed && setSelectedOption(opt.key)}
                    disabled={revealed || submitting}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-4 transition-all flex items-start gap-3",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                      !revealed && !isSelected && "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30",
                      !revealed && isSelected && "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20",
                      isCorrect && "border-emerald-500 bg-emerald-50",
                      isWrongSelected && "border-red-500 bg-red-50",
                      revealed && !isCorrect && !isWrongSelected && "border-slate-200 bg-slate-50 opacity-60"
                    )}
                  >
                    {/* Letter badge */}
                    <div
                      className={cn(
                        "size-8 shrink-0 rounded-lg flex items-center justify-center font-semibold text-sm transition-colors",
                        !revealed && !isSelected && "bg-slate-100 text-slate-600",
                        !revealed && isSelected && "bg-emerald-500 text-white",
                        isCorrect && "bg-emerald-500 text-white",
                        isWrongSelected && "bg-red-500 text-white",
                        revealed && !isCorrect && !isWrongSelected && "bg-slate-200 text-slate-500"
                      )}
                    >
                      {revealed && isCorrect ? (
                        <CheckCircle2 className="size-5" />
                      ) : revealed && isWrongSelected ? (
                        <XCircle className="size-5" />
                      ) : (
                        opt.key
                      )}
                    </div>

                    {/* Option text / image */}
                    <div className="flex-1 pt-1 min-w-0">
                      {opt.image ? (
                        <img
                          src={opt.image}
                          alt={`Option ${opt.key}`}
                          className="max-h-32 w-auto rounded"
                        />
                      ) : (
                        <p className="text-slate-900">{opt.text}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Feedback panel after reveal */}
            <AnimatePresence>
              {revealed && revealedResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mt-5 rounded-xl border p-4",
                    revealedResult.isCorrect
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {revealedResult.isCorrect ? (
                      <CheckCircle2 className="size-5 text-emerald-600 mt-0.5" />
                    ) : (
                      <XCircle className="size-5 text-red-600 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={cn(
                          "font-semibold text-sm",
                          revealedResult.isCorrect
                            ? "text-emerald-700"
                            : "text-red-700"
                        )}
                      >
                        {revealedResult.isCorrect
                          ? "Correct!"
                          : `Not quite — the answer is ${revealedResult.correctOption}`}
                      </p>
                      {revealedResult.explanation && (
                        <div className="mt-2 flex items-start gap-1.5 text-sm text-slate-700">
                          <Info className="size-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <p>{revealedResult.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Action button */}
            <div className="mt-6 flex justify-end">
              {isExamMode ? (
                // Exam mode: single button that records + advances.
                // No "Check answer" — no feedback is shown.
                <Button
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={!selectedOption || submitting}
                  onClick={handleReveal}
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {currentIndex < totalQuestions - 1 ? (
                    <>
                      Next question
                      <ChevronRight className="size-5" />
                    </>
                  ) : (
                    <>
                      {submitting && <Loader2 className="size-4 animate-spin" />}
                      Finish quiz
                    </>
                  )}
                </Button>
              ) : !revealed ? (
                // Immediate mode, before reveal: "Check answer"
                <Button
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={!selectedOption || submitting}
                  onClick={handleReveal}
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Check answer
                </Button>
              ) : (
                // Immediate mode, after reveal: "Next question" / "See results"
                <Button
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={submitting}
                  onClick={handleNext}
                >
                  {currentIndex < totalQuestions - 1 ? (
                    <>
                      Next question
                      <ChevronRight className="size-5" />
                    </>
                  ) : (
                    <>
                      {submitting && <Loader2 className="size-4 animate-spin" />}
                      See results
                    </>
                  )}
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
