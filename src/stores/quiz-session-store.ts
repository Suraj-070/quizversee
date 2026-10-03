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
 *   1. QuizSetup calls start() with attemptId + questions
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
};

export type AnswerResult = {
  selectedOption: "A" | "B" | "C" | "D";
  isCorrect: boolean;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string | null;
};

type QuizSessionState = {
  attemptId: string | null;
  questions: QuizQuestionClient[];
  currentIndex: number;
  /** Map of questionId → answer result. Cleared on session end. */
  answers: Record<string, AnswerResult>;

  start: (attemptId: string, questions: QuizQuestionClient[]) => void;
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

      start: (attemptId, questions) =>
        set({
          attemptId,
          questions,
          currentIndex: 0,
          answers: {},
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
        }),
    }),
    {
      name: "quizverse-quiz-session",
      version: 1,
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
