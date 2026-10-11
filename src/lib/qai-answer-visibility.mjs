/** Exam mode is a server-side property of the attempt, not a trusted request parameter. */
export function canRevealSubmittedAnswer(feedbackMode, requestedReveal) {
  return feedbackMode === "immediate" && requestedReveal === true;
}
