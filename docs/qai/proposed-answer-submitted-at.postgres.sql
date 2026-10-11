-- PROPOSED ONLY — DO NOT RUN WITHOUT SEPARATE APPROVAL.
-- PostgreSQL/Supabase addition for atomic answer claiming.
-- The application must be updated to use submittedAt BEFORE enabling the strict path.
-- Backfill must NOT infer submission from selectedOption='A' or answeredAt:
-- placeholders currently have both values even when unanswered.
BEGIN;
ALTER TABLE "UserAnswer"
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "UserAnswer_attemptId_submittedAt_idx"
  ON "UserAnswer" ("attemptId", "submittedAt");
COMMIT;
-- Existing non-null selectedOption/answeredAt are not evidence of submission.
-- Treat any pre-migration in-progress attempts as legacy: complete or restart them
-- before turning on the strict pathway. Completed attempts remain immutable.
