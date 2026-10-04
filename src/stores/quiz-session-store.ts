"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Quiz session store — tracks the active quiz session state.
 *
 * Persisted to localStorage so that a page refresh mid-quiz doesn't lose
 * progress. On reload, the AppShell reads this and resumes the user
 * into the active quiz screen.
 *
 * Lifecycle:
 *   1. QuizSetup calls start() with attemptId + questions + feedbackMode
 *   2. QuizActive advances one question at a time via setCurrentIndex()
 *   3. Each answer is recorded via recordAnswer()
 *   4. On completion, complete() clears the session
 *
 * Per PRD §37: "Keep quiz session state organized so refreshing or
 * accidental navigation does not easily corrupt completed attempts."
 */

export type QuizQuestionClient = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  explanation: string | null;
  userAnswerId: string;
  // Optional images (base64 data URIs or URLs).
  questionImage: string | null;
  optionAImage: string | null;
  optionBImage: string | null;
  optionCImage: string | null;
  optionDImage: string | null;
};

export type FeedbackMode = "immediate" | "exam";

export type AnswerResult = {
  selectedOption: "A" | "B" | "C" | "D";
  /**
   * In "immediate" mode, isCorrect + correctOption + explanation are
   * filled in right after the user submits (the server returns them).
   *
   * In "exam" mode, these stay null until the quiz is completed —
   * the server records the answer without revealing correctness, and
   * the client learns the results only on the results/review screen
   * (which fetches the full attempt from /api/student/attempts).
   */
  isCorrect: boolean | null;
  correctOption: "A" | "B" | "C" | "D" | null;
  explanation: string | null;
};

type QuizSessionState = {
  attemptId: string | null;
  questions: QuizQuestionClient[];
  currentIndex: number;
  /** Map of questionId → answer result. Cleared on session end. */
  answers: Record<string, AnswerResult>;
  /** When "exam", no feedback is shown until the end. */
  feedbackMode: FeedbackMode;

  start: (
    attemptId: string,
    questions: QuizQuestionClient[],
    feedbackMode?: FeedbackMode
  ) => void;
  setCurrentIndex: (index: number) => void;
  recordAnswer: (questionId: string, result: AnswerResult) => void;
  /** Mark session as complete (results screen). */
  complete: () => void;
  /** Fully clear the session (called from results "back to topics"). */
  clear: () => void;
};

export const useQuizSessionStore = create<QuizSessionState>()(
  persist(
    (set) => ({
      attemptId: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      feedbackMode: "immediate",

      start: (attemptId, questions, feedbackMode = "immediate") =>
        set({
          attemptId,
          questions,
          currentIndex: 0,
          answers: {},
          feedbackMode,
        }),
      setCurrentIndex: (index) => set({ currentIndex: index }),
      recordAnswer: (questionId, result) =>
        set((state) => ({
          answers: { ...state.answers, [questionId]: result },
        })),
      complete: () =>
        set((state) => ({
          // Keep answers so the results/review screens can show them,
          // but mark the attempt as completed by clearing attemptId.
          // Actually we keep attemptId so results/review can fetch.
          attemptId: state.attemptId,
        })),
      clear: () =>
        set({
          attemptId: null,
          questions: [],
          currentIndex: 0,
          answers: {},
          feedbackMode: "immediate",
        }),
    }),
    {
      name: "quizverse-quiz-session",
      version: 2,
    }
  )
);

/**
 * Helper hook: returns true if there's an active (in-progress) quiz
 * session that the user should be resumed into.
 */
export function useHasActiveQuizSession() {
  const attemptId = useQuizSessionStore((s) => s.attemptId);
  const questions = useQuizSessionStore((s) => s.questions);
  const answers = useQuizSessionStore((s) => s.answers);

  // Active iff attemptId is set AND not all questions have been answered
  if (!attemptId || questions.length === 0) return false;
  const answeredCount = Object.keys(answers).length;
  return answeredCount < questions.length;
}
