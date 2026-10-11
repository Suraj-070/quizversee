/** Shared quiz settings — the one-question quick practice option is always available. */
export const DEFAULT_QUIZ_COUNTS = [1, 5, 10, 20, 30, 40, 50] as const;
export type QuizFeedbackMode = "immediate" | "exam";

export function normalizeQuizCounts(value: unknown): number[] {
  const values = Array.isArray(value) ? value : [...DEFAULT_QUIZ_COUNTS];
  return [...new Set([
    1,
    ...values.filter((n): n is number =>
      typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 100),
  ])].sort((a, b) => a - b);
}

export function chooseQuizCount(available: number[], preferred: number): number | null {
  if (!available.length) return null;
  if (available.includes(preferred)) return preferred;
  return available.filter((n) => n <= preferred).at(-1) ?? available[0];
}

export function parseStoredSetting(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function quizFeedbackSetting(value: unknown, fallback: QuizFeedbackMode): QuizFeedbackMode {
  return value === "immediate" || value === "exam" ? value : fallback;
}
