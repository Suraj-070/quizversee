-- PROPOSAL ONLY. NOT APPLIED TO SUPABASE.
-- Required before deploying server-enforced exam mode.
-- Existing attempts default to immediate for historical compatibility.
ALTER TABLE public."QuizAttempt"
  ADD COLUMN IF NOT EXISTS "feedbackMode" TEXT NOT NULL DEFAULT 'immediate';
ALTER TABLE public."QuizAttempt"
  ADD CONSTRAINT "QuizAttempt_feedbackMode_check"
  CHECK ("feedbackMode" IN ('immediate','exam'));
-- Run once through an approved Supabase migration, after checking existing constraints.
