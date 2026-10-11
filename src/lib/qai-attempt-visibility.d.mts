export type AttemptAnswer = {
  submittedAt?: Date | string | null;
  selectedOption: string;
  isCorrect: boolean | null;
  question: {
    correctOption: string | null;
    explanation: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
export function visibleAttemptAnswers<T extends AttemptAnswer>(answers: T[], completedAt: Date | string | null, metadata?: { startedAt?: Date | string; activationAt?: string }): Array<T | (Omit<T, "selectedOption" | "isCorrect" | "question"> & {selectedOption: string | null; isCorrect: null; question: T["question"] & {correctOption: null; explanation: null}})>;
