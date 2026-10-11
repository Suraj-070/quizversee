-- HISTORICAL MIGRATION RECORD: APPLIED to Supabase on 2026-10-11.
-- Migration: add_quiz_attempt_feedback_mode_for_qai (20261011044051).
-- Do not run this migration a second time.
-- Was required for server-enforced exam mode; deployment still pending.
-- Existing attempts default to immediate for historical compatibility.
ALTER TABLE public."QuizAttempt"
  ADD COLUMN IF NOT EXISTS "feedbackMode" TEXT NOT NULL DEFAULT 'immediate';
ALTER TABLE public."QuizAttempt"
  ADD CONSTRAINT "QuizAttempt_feedbackMode_check"
  CHECK ("feedbackMode" IN ('immediate','exam'));
-- Run once through an approved Supabase migration, after checking existing constraints.
