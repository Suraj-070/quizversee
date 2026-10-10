/**
 * Redact protected answer data from unfinished attempts.
 * The old "A" placeholder is not evidence of submission.
 */
export function visibleAttemptAnswers(answers, completedAt) {
  if (completedAt) return answers;
  return answers.map(a => ({
    ...a,
    selectedOption: a.submittedAt ? a.selectedOption : null,
    isCorrect: null,
    question: {
      ...a.question,
      correctOption: null,
      explanation: null,
    },
  }));
}
