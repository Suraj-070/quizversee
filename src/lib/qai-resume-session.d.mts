import type { QuizQuestionClient, FeedbackMode, AnswerResult } from "../stores/quiz-session-store";
export function buildResumableQuiz(attempt: unknown): {
  attemptId: string;
  questions: QuizQuestionClient[];
  answers: Record<string, AnswerResult>;
  feedbackMode: FeedbackMode;
  currentIndex: number;
};
