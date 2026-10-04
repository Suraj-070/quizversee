import { cn } from "@/lib/utils";

/**
 * Quiz Theme Registry
 *
 * Per PRD §24 (Different Visual Vibes):
 *   "Architect the quiz interface so visual themes can eventually be
 *    changed without changing quiz logic. For V1, implement one
 *    excellent default theme. However, separate Quiz logic from Quiz
 *    visual presentation. This will allow future themes such as:
 *    Focus, Chill, Arcade, Dark, Minimal — without rebuilding the
 *    quiz engine."
 *
 * This registry defines a Theme shape that the QuizActive component
 * consumes. V1 ships a single "default" theme. Adding a new theme is
 * a single registry entry — no quiz engine changes required.
 */

export type QuizTheme = {
  /** Unique key for the theme */
  id: string;
  /** Human-readable name shown in theme picker (when one exists) */
  name: string;
  /** One-line description of the vibe */
  description: string;

  /** Background gradient for the quiz screen */
  pageBg: string;
  /** Card background for the question text */
  questionCardBg: string;
  /** Class for unselected option buttons */
  optionIdle: string;
  /** Class for selected option buttons (before reveal) */
  optionSelected: string;
  /** Class for the correct option (after reveal) */
  optionCorrect: string;
  /** Class for the wrong-selected option (after reveal) */
  optionWrong: string;
  /** Class for the action button (Check answer / Next) */
  actionButton: string;
  /** Class for the feedback panel when correct */
  feedbackCorrect: string;
  /** Class for the feedback panel when wrong */
  feedbackWrong: string;
  /** Class for the progress bar fill */
  progressFill: string;
};

const THEMES: Record<string, QuizTheme> = {
  default: {
    id: "default",
    name: "Default",
    description: "Clean emerald — bright, focused, modern.",
    pageBg: "bg-gradient-to-b from-slate-50 to-white",
    questionCardBg: "",
    optionIdle:
      "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30",
    optionSelected: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20",
    optionCorrect: "border-emerald-500 bg-emerald-50",
    optionWrong: "border-red-500 bg-red-50",
    actionButton: "bg-emerald-500 hover:bg-emerald-600 text-white",
    feedbackCorrect: "border-emerald-200 bg-emerald-50",
    feedbackWrong: "border-red-200 bg-red-50",
    progressFill: "",
  },
};

/**
 * Resolves a theme by id. Falls back to "default" for unknown themes.
 *
 * In V1 the theme is always "default". A future admin setting or user
 * preference could pass a different theme id here — the quiz engine
 * itself doesn't need to change.
 */
export function resolveQuizTheme(id: string | null | undefined): QuizTheme {
  if (id && THEMES[id]) return THEMES[id];
  return THEMES.default;
}

/**
 * Helper: returns the cn()-merged class for a given option state.
 */
export function optionClassFor(
  theme: QuizTheme,
  state: "idle" | "selected" | "correct" | "wrong" | "muted"
): string {
  switch (state) {
    case "selected":
      return theme.optionSelected;
    case "correct":
      return theme.optionCorrect;
    case "wrong":
      return theme.optionWrong;
    case "muted":
      return "border-slate-200 bg-slate-50 opacity-60";
    default:
      return theme.optionIdle;
  }
}

/**
 * Exposed helper so QuizActive can import both the theme + the cn helper
 * in one call site without circular deps.
 */
export { cn };
