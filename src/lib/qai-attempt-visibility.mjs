/**
 * Redact protected answer data from unfinished attempts.
 * The old "A" placeholder is not evidence of submission.
 * Historical completed answers predate submittedAt, so preserve their reviews.
 */
export function visibleAttemptAnswers(answers, completedAt, metadata = {}) {
  const activation = Date.parse(metadata.activationAt ?? "");
  const started = new Date(metadata.startedAt ?? "").getTime();
  const isModernAttempt =
    Number.isFinite(activation) &&
    Number.isFinite(started) &&
    started >= activation;

  if (completedAt) {
    if (!isModernAttempt) return answers;
    return answers.map((answer) =>
      answer.submittedAt
        ? answer
        : { ...answer, selectedOption: null, isCorrect: null }
    );
  }

  return answers.map(answer => ({
    ...answer,
    selectedOption: answer.submittedAt ? answer.selectedOption : null,
    isCorrect: null,
    question: {
      ...answer.question,
      correctOption: null,
      explanation: null,
    },
  }));
}
