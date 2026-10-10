/**
 * Legacy quiz attempts created before the atomic answer rollout have
 * ambiguous placeholder answers. Do not silently score or re-submit them.
 */
export function isLegacyAttempt(startedAt, activationAt) {
  if (!activationAt || !Number.isFinite(Date.parse(activationAt)))
    throw new Error("QAI_ANSWER_ACTIVATION_AT must be a valid ISO timestamp");
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) throw new Error("Invalid attempt start time");
  return started < Date.parse(activationAt);
}
