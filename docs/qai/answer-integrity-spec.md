# Atomic answer submission — implementation specification

**Status:** gated and awaiting a separately approved Supabase migration. Do not execute the accompanying SQL yet.

## Root cause
Quizverse seeds one `UserAnswer` placeholder for each question with `selectedOption: "A"`, `isCorrect: false`, and a timestamp. These fields **cannot distinguish** an unanswered placeholder from a submitted answer (especially when the student selects A). The existing PATCH endpoint can therefore update mastery repeatedly.

## PostgreSQL schema change
- Add `UserAnswer.submittedAt DateTime?`, nullable, default null.
- Proposed SQL at `docs/qai/proposed-answer-submitted-at.postgres.sql`.
- Existing rows are deliberately **not backfilled** with made-up submission timestamps.
- Block editing completed attempts; in-progress legacy attempts started before activation should be restarted.

## Correct transactional write algorithm (next activation gate)
1. Authenticate and confirm answer belongs to current user and attempt; reject completed attempt.
2. Load correct option from the database; never accept a correct answer from the client.
3. In **one PostgreSQL transaction**, atomically claim the answer:
   `UPDATE "UserAnswer" SET "selectedOption"=$1, "isCorrect"=$2, "answeredAt"=now(), "submittedAt"=now() WHERE "id"=$3 AND "userId"=$4 AND "attemptId"=$5 AND "submittedAt" IS NULL AND EXISTS (SELECT 1 FROM "QuizAttempt" WHERE "id"=$5 AND "userId"=$4 AND "completedAt" IS NULL) RETURNING "id"`
4. If zero rows were claimed, return HTTP 409 without changing mastery.
5. Update `QuestionMastery` **within the same transaction**. Use serializable transaction isolation and retry serialization conflicts a small bounded number of times to avoid lost increments across simultaneous attempts.
6. Reveal the answer only after a successful claim and only when `reveal !== false`.
7. Completion must count only submitted rows, and reject new submissions once completed (including races); serialize attempt completion with claims.
8. Do not enable the strict pathway before schema migration and integration tests.

## Tests required before enabling
- Two simultaneous PATCH requests for the same answer → exactly one claim, mastery increment once.
- Same option twice → second request 409; selecting A works normally on first submission.
- Attempt already completed → 409/404; no changes.
- Someone else's attempt/answer → 404; no changes.
- Exam mode response never reveals correctOption/explanation.
- If mastery transaction fails, answer claim rolls back.
- Partial/in-progress legacy quiz → requires restart, not silent backfill.
- Verify question review and score are correct for unanswered items and completed attempts.
- Regular topic/subject quizzes and quiz-set attempts stay operational.

## Rollout stages
A. Approve and apply **additive, nullable** schema change separately in Supabase.
B. Regenerate Prisma client from the user's actual PostgreSQL schema, not GitHub `main` SQLite schema.
C. Implement transactional, serializable claim pathway and regression tests; flag off by default.
D. Verify in local/staging PostgreSQL.
E. Turn on for a controlled development trial, then consider production.

Current release status: the answer endpoint blocks already-completed attempts, but **duplicate active-attempt answers are not yet fixed**. QAI feature flag should stay OFF for production.
