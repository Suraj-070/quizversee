/**
 * Generates varied, contextual feedback messages based on the student's
 * performance state — inspired by Duolingo's dynamic praise system.
 *
 * Instead of always saying "Correct!" or "Not quite", we vary the
 * message based on:
 *   - Current streak (consecutive correct answers)
 *   - Whether it's the first question
 *   - Whether they're recovering from a wrong streak
 *   - Speed of answering
 */

const CORRECT_MESSAGES = [
  "Correct!",
  "That's right!",
  "Well done!",
  "You got it!",
];

const STREAK_MESSAGES: Record<number, string[]> = {
  3: ["🔥 3 in a row!", "On a roll!", "Three straight!"],
  5: ["🔥 5 in a row! You're on fire!", "Unstoppable!", "Five in a row!"],
  7: ["🔥🔥 7 in a row! Incredible!", "Lightning streak!", "Seven straight!"],
  10: ["🔥🔥🔥 10 in a row! Perfect!", "Legendary streak!", "Ten in a row!"],
};

const RECOVERY_MESSAGES = [
  "Back on track! 💪",
  "Nice recovery!",
  "You've got it now!",
];

const FIRST_TRY_MESSAGES = [
  "Nailed it on the first try! 🎯",
  "First try! Impressive!",
  "Instant correct! ⚡",
];

const WRONG_MESSAGES = [
  "Not quite — the answer is",
  "Close, but the answer is",
  "Almost! The correct answer is",
  "Good try — the answer is",
];

const WRONG_AFTER_STREAK = [
  "Streak broken, but you'll bounce back!",
  "Don't worry — the answer is",
  "That was tricky! The answer is",
];

/**
 * Returns a contextual feedback message.
 */
export function getFeedbackMessage(
  isCorrect: boolean,
  streak: number,
  isRecovery: boolean,
  isFirstTry: boolean,
  wasOnStreak: boolean
): string {
  if (isCorrect) {
    // Priority: streak > recovery > first try > generic
    if (streak >= 10 && STREAK_MESSAGES[10]) {
      return pickRandom(STREAK_MESSAGES[10]);
    }
    if (streak >= 7 && STREAK_MESSAGES[7]) {
      return pickRandom(STREAK_MESSAGES[7]);
    }
    if (streak >= 5 && STREAK_MESSAGES[5]) {
      return pickRandom(STREAK_MESSAGES[5]);
    }
    if (streak >= 3 && STREAK_MESSAGES[3]) {
      return pickRandom(STREAK_MESSAGES[3]);
    }
    if (isRecovery) {
      return pickRandom(RECOVERY_MESSAGES);
    }
    if (isFirstTry) {
      return pickRandom(FIRST_TRY_MESSAGES);
    }
    return pickRandom(CORRECT_MESSAGES);
  } else {
    if (wasOnStreak) {
      return pickRandom(WRONG_AFTER_STREAK);
    }
    return pickRandom(WRONG_MESSAGES);
  }
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Milestone messages shown at 25%, 50%, 75% of questions answered.
 */
export const MILESTONE_MESSAGES: Record<string, string> = {
  "25": "Quarter way there! 🎯",
  "50": "Halfway! Keep going 💪",
  "75": "Almost done! 🚀",
};
