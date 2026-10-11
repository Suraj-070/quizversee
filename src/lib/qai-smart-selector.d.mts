export type QaiCandidate = { id: string };
export type QaiMastery = {
  questionId: string;
  timesSeen: number;
  timesCorrect: number;
  nextDueAt: Date | string | null;
  lastSeenAt?: Date | string | null;
};
export function chooseAdaptiveQuestions(options: {
  questions: QaiCandidate[];
  mastery: QaiMastery[];
  count: number;
  now?: Date;
  random?: () => number;
  recentIds?: string[];
}): string[];
