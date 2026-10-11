/**
 * Rebuild a quiz from the authenticated, server-redacted attempt response.
 * Does not trust old localStorage for answer correctness or attempt ownership.
 */
export function buildResumableQuiz(attempt) {
  if (!attempt || attempt.completedAt || !attempt.id || !Array.isArray(attempt.answers)) {
    throw new Error("Quiz attempt is no longer available to resume");
  }
  const questions = [];
  const recordedAnswers = {};
  const seen = new Set();
  for (const answer of [...attempt.answers].sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')))) {
    const q = answer?.question;
    if (!q?.id || !answer?.id || seen.has(q.id)) {
      throw new Error("Quiz attempt contains invalid questions");
    }
    seen.add(q.id);
    questions.push({
      id: q.id,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      explanation: null,
      questionImage: q.questionImage ?? null,
      optionAImage: q.optionAImage ?? null,
      optionBImage: q.optionBImage ?? null,
      optionCImage: q.optionCImage ?? null,
      optionDImage: q.optionDImage ?? null,
      userAnswerId: answer.id,
    });
    if (answer.submittedAt && ["A", "B", "C", "D"].includes(answer.selectedOption)) {
      recordedAnswers[q.id] = {
        selectedOption: answer.selectedOption,
        isCorrect: null,
        correctOption: null,
        explanation: null,
      };
    }
  }
  if (!questions.length || questions.length !== attempt.totalQuestions) {
    throw new Error("Quiz attempt has an invalid question count");
  }
  const index = questions.findIndex(q => !recordedAnswers[q.id]);
  return {
    attemptId: attempt.id,
    questions,
    answers: recordedAnswers,
    feedbackMode: attempt.feedbackMode === "exam" ? "exam" : "immediate",
    currentIndex: index === -1 ? questions.length - 1 : index,
  };
}
