"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  XCircle,
  Flag,
  Clock,
  Grid3x3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { useQuizSessionStore, type AnswerResult } from "@/stores/quiz-session-store";
import { StudentHeader } from "@/components/student/student-header";
import { QuestionNavigator } from "@/components/quiz/question-navigator";
import { getFeedbackMessage, MILESTONE_MESSAGES } from "@/lib/quiz-feedback";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Set<string>>(new Set());
  const flagged = !!questions[currentIndex] && flaggedQuestionIds.has(questions[currentIndex].id);
  const [flagToggling, setFlagToggling] = useState(false);
  const [streak, setStreak] = useState(0);
  const [wasOnStreak, setWasOnStreak] = useState(false);

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Question navigator
  const [navigatorOpen, setNavigatorOpen] = useState(false);

  // Pre-submit review modal
  const [showPreSubmit, setShowPreSubmit] = useState(false);

  // Track milestones shown
  const milestonesShown = useRef<Set<string>>(new Set());

  const isExamMode = feedbackMode === "exam";

  // ---------- Timer effect ----------
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format timer as MM:SS
  const timerDisplay = `${String(Math.floor(elapsedSeconds / 60)).padStart(
    2,
    "0"
  )}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  // ---------- Reset local state when the question changes ----------
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

    // Flags are loaded once for the session; avoid async per-question races.
  }, [currentIndex, questions, answers, isExamMode]);

  // Load bookmarked question IDs so navigator and exam summary use all quiz flags.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/questions/flagged")
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load flagged questions");
        return res.json();
      })
      .then((data: { flags: Array<{ question: { id: string } }> }) => {
        if (!cancelled) setFlaggedQuestionIds(new Set(data.flags.map((flag) => flag.question.id)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ---------- Track streak from answers ----------
  useEffect(() => {
    // Count consecutive correct answers from the answers map
    let currentStreak = 0;
    let maxStreak = 0;
    for (const q of questions) {
      const ans = answers[q.id];
      if (ans && ans.isCorrect) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (ans) {
        currentStreak = 0;
      }
    }
    setStreak(currentStreak);
  }, [answers, questions]);

  // ---------- Progress milestones ----------
  useEffect(() => {
    const answeredCount = Object.keys(answers).length;
    const total = questions.length;
    if (total === 0) return;
    const pct = (answeredCount / total) * 100;

    for (const [threshold, msg] of Object.entries(MILESTONE_MESSAGES)) {
      if (pct >= parseInt(threshold) && !milestonesShown.current.has(threshold)) {
        milestonesShown.current.add(threshold);
        toast.success(msg, { duration: 2500 });
      }
    }
  }, [answers, questions.length]);

  // ---------- Exit protection (beforeunload) ----------
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const answeredCount = Object.keys(answers).length;
      if (answeredCount < questions.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [answers, questions.length]);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't interfere with form inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      // 1-4 / A-D: select option
      if (["1", "2", "3", "4", "a", "b", "c", "d"].includes(e.key.toLowerCase())) {
        if (!revealed && !submitting) {
          const map: Record<string, "A" | "B" | "C" | "D"> = {
            "1": "A", "a": "A",
            "2": "B", "b": "B",
            "3": "C", "c": "C",
            "4": "D", "d": "D",
          };
          const opt = map[e.key.toLowerCase()];
          if (opt) {
            e.preventDefault();
            setSelectedOption(opt);
          }
        }
      }

      // Enter: confirm or advance
      if (e.key === "Enter") {
        e.preventDefault();
        if (!revealed && selectedOption && !submitting) {
          handleReveal();
        } else if (revealed && !submitting) {
          handleNext();
        } else if (isExamMode && selectedOption && !submitting) {
          handleReveal();
        }
      }

      // F: toggle flag
      if (e.key.toLowerCase() === "f" && !flagToggling) {
        e.preventDefault();
        toggleFlag();
      }

      // N: toggle navigator
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setNavigatorOpen((v) => !v);
      }

      // Arrow Left/Right: navigate questions
      if (e.key === "ArrowLeft" && currentIndex > 0 && !submitting) {
        e.preventDefault();
        setCurrentIndex(currentIndex - 1);
      }
      if (e.key === "ArrowRight" && currentIndex < questions.length - 1 && !submitting) {
        e.preventDefault();
        setCurrentIndex(currentIndex + 1);
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [revealed, selectedOption, submitting, currentIndex, questions.length, flagToggling]);

  // ---------- Flag toggle ----------
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
      setFlaggedQuestionIds((previous) => {
        const next = new Set(previous);
        if (data.flagged) next.add(q.id);
        else next.delete(q.id);
        return next;
      });
    } catch {
      // ignore
    } finally {
      setFlagToggling(false);
    }
  }

  // ---------- Handle reveal/submit answer ----------
  const handleReveal = useCallback(async () => {
    if (!selectedOption || submitting || revealed) return;
    setSubmitting(true);
    setError(null);

    const wasOnStreakBefore = streak >= 3;

    try {
      const res = await fetch(
        `/api/student/attempts/${attemptId}/answer`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAnswerId: questions[currentIndex]?.userAnswerId,
            selectedOption,
            reveal: !isExamMode,
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to submit answer");
      }

      if (isExamMode) {
        recordAnswer(questions[currentIndex]?.id, {
          selectedOption,
          isCorrect: null,
          correctOption: null,
          explanation: null,
        });
        handleNext();
      } else {
        const data = (await res.json()) as AnswerResult;
        recordAnswer(questions[currentIndex]?.id, data);
        setRevealedResult(data);
        setRevealed(true);

        // Generate contextual feedback message
        const newStreak = data.isCorrect ? streak + 1 : 0;
        const isRecovery = streak === 0 && data.isCorrect;
        const isFirstTry = currentIndex === 0 && data.isCorrect;
        const msg = getFeedbackMessage(
          data.isCorrect,
          newStreak,
          isRecovery,
          isFirstTry,
          wasOnStreakBefore
        );
        setFeedbackMsg(msg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }, [selectedOption, submitting, revealed, attemptId, questions, currentIndex, isExamMode, streak, recordAnswer]);

  // ---------- Handle next / complete ----------
  function handleNext() {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Last question
      if (isExamMode) {
        // Show pre-submit review modal in exam mode
        setShowPreSubmit(true);
      } else {
        handleComplete();
      }
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

  // ---------- Validate session ----------
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

  // Sets for the navigator
  const answeredIds = new Set(Object.keys(answers));
  const flaggedIds = new Set(questions.filter((q) => flaggedQuestionIds.has(q.id)).map((q) => q.id));
  const questionIds = questions.map((q) => q.id);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <StudentHeader user={user} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 pb-24">
        {/* Progress header with timer + streak */}
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
              {streak >= 3 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-semibold"
                >
                  🔥 {streak}
                </motion.span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Timer */}
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono">
                <Clock className="size-3.5" />
                {timerDisplay}
              </span>
              {/* Answered / Remaining */}
              <p className="text-xs text-slate-500">
                {answeredCount} · {remaining} left
              </p>
            </div>
          </div>
          <Progress value={progressValue} className="h-1.5" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Question */}
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 leading-relaxed flex-1 tracking-tight">
                {question.questionText}
              </h1>
              <button
                type="button"
                onClick={toggleFlag}
                disabled={flagToggling}
                className={cn(
                  "shrink-0 size-9 rounded-lg flex items-center justify-center transition-all duration-200",
                  flagged
                    ? "bg-amber-100 text-amber-600 hover:bg-amber-200 scale-105"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                )}
                title={flagged ? "Unflag (F)" : "Flag for review (F)"}
                aria-label={flagged ? "Remove question flag" : "Flag question for review"}
              >
                <Flag className={cn("size-4 transition-transform", flagged && "fill-current scale-110")} />
              </button>
            </div>

            {/* Optional question image */}
            {question.questionImage && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <img
                  src={question.questionImage}
                  alt="Question figure"
                  className="max-h-64 w-auto mx-auto rounded-lg"
                />
              </div>
            )}

            {/* Options */}
            <div className="mt-6 space-y-2.5">
              {options.map((opt, optIdx) => {
                const isSelected = selectedOption === opt.key;
                const isCorrect =
                  revealed && revealedResult?.correctOption === opt.key;
                const isWrongSelected =
                  revealed && isSelected && !revealedResult?.isCorrect;

                return (
                  <motion.button
                    key={opt.key}
                    type="button"
                    onClick={() => !revealed && setSelectedOption(opt.key)}
                    disabled={revealed || submitting}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + optIdx * 0.04, duration: 0.2, ease: "easeOut" }}
                    whileTap={!revealed ? { scale: 0.995 } : undefined}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-4 transition-all duration-200 flex items-start gap-3",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                      !revealed && !isSelected && "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm",
                      !revealed && isSelected && "border-emerald-500 bg-emerald-50 shadow-glow-emerald",
                      isCorrect && "border-emerald-500 bg-emerald-50 shadow-glow-emerald",
                      isWrongSelected && "border-red-500 bg-red-50",
                      revealed && !isCorrect && !isWrongSelected && "border-slate-200 bg-slate-50/60 opacity-50"
                    )}
                  >
                    {/* Letter badge */}
                    <div
                      className={cn(
                        "size-8 shrink-0 rounded-lg flex items-center justify-center font-semibold text-sm transition-all duration-200",
                        !revealed && !isSelected && "bg-slate-100 text-slate-600",
                        !revealed && isSelected && "bg-emerald-500 text-white scale-110",
                        isCorrect && "bg-emerald-500 text-white",
                        isWrongSelected && "bg-red-500 text-white",
                        revealed && !isCorrect && !isWrongSelected && "bg-slate-200 text-slate-400"
                      )}
                    >
                      {revealed && isCorrect ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
                          <CheckCircle2 className="size-5" />
                        </motion.span>
                      ) : revealed && isWrongSelected ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
                          <XCircle className="size-5" />
                        </motion.span>
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
                          className="max-h-32 w-auto rounded-lg"
                        />
                      ) : (
                        <p className={cn(
                          "text-slate-900 transition-colors",
                          revealed && !isCorrect && !isWrongSelected && "text-slate-500"
                        )}>
                          {opt.text}
                        </p>
                      )}
                    </div>

                    {/* Keyboard hint */}
                    {!revealed && (
                      <kbd className="hidden sm:inline-flex shrink-0 items-center justify-center size-6 rounded text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-200">
                        {optIdx + 1}
                      </kbd>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Feedback panel after reveal */}
            <AnimatePresence>
              {revealed && revealedResult && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "mt-5 rounded-xl border p-4",
                    revealedResult.isCorrect
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {revealedResult.isCorrect ? (
                      <CheckCircle2 className="size-5 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="size-5 text-red-600 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p
                        className={cn(
                          "font-semibold text-sm",
                          revealedResult.isCorrect
                            ? "text-emerald-700"
                            : "text-red-700"
                        )}
                      >
                        {feedbackMsg}
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
            <div className="mt-6 flex justify-end items-center gap-2">
              {/* Keyboard hint */}
              <span className="hidden sm:flex items-center gap-2 text-xs text-slate-400 mr-auto">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">1-4</kbd>
                select
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Enter</kbd>
                confirm
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">F</kbd>
                flag
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">N</kbd>
                navigator
              </span>

              {isExamMode ? (
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

      {/* Question Navigator */}
      <QuestionNavigator
        total={totalQuestions}
        currentIndex={currentIndex}
        answeredIds={answeredIds}
        flaggedIds={flaggedIds}
        questionIds={questionIds}
        open={navigatorOpen}
        onToggle={() => setNavigatorOpen((v) => !v)}
        onJump={(i) => setCurrentIndex(i)}
      />

      {/* Pre-submit review modal (exam mode only) */}
      <AnimatePresence>
        {showPreSubmit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setShowPreSubmit(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                Ready to submit?
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                You're about to finish this exam. Here's your summary:
              </p>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                  <p className="text-xl font-bold text-emerald-700">{answeredCount}</p>
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wider">Answered</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                  <p className="text-xl font-bold text-amber-700">{flaggedIds.size}</p>
                  <p className="text-[10px] text-amber-600 uppercase tracking-wider">Flagged</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
                  <p className="text-xl font-bold text-slate-700">{remaining}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Unanswered</p>
                </div>
              </div>

              {/* Question grid */}
              <div className="grid grid-cols-8 gap-1.5 mb-5 max-h-32 overflow-y-auto">
                {questions.map((q, i) => {
                  const isAnswered = !!answers[q.id];
                  const isCurrent = i === currentIndex;
                  return (
                    <div
                      key={q.id}
                      className={cn(
                        "size-7 rounded text-[10px] font-semibold flex items-center justify-center",
                        isCurrent && "ring-2 ring-emerald-500",
                        isAnswered ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPreSubmit(false)}
                >
                  Keep reviewing
                </Button>
                <Button
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={() => {
                    setShowPreSubmit(false);
                    handleComplete();
                  }}
                >
                  Submit exam
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
