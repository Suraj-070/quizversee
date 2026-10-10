# Quizverse QAI Phase 1 — rollout and database safety

## Implemented in GitHub main
- `src/lib/qai-smart-selector.mjs`: pure adaptive selector using the **existing** `QuestionMastery` columns, with Bayesian-smoothed weakness, overdue review priority, novelty, recent-question suppression and a small exploration quota.
- `src/app/api/student/smart-practice/route.ts`: switchable algorithm **only for the existing Smart Practice endpoint**.
- `tests/qai-smart-selector.test.mjs`: six unit tests, run with `node --test tests/qai-smart-selector.test.mjs`.
- Standard topic quizzes, subject exams, quiz-set attempts, answer submission and completion routes are unchanged.
- **Feature flag defaults OFF**. To evaluate in development only after testing, set `QAI_SMART_PRACTICE_V1=true` in a local ignored environment file and restart the dev server.

## Database migration policy
GitHub `main` previously had SQLite in `prisma/schema.prisma`, while the owner's local `migrate/supabase` branch uses PostgreSQL. **We intentionally did not edit or overwrite `prisma/schema.prisma`.**
Phase 1 adaptive selection is compatible with the existing Prisma schema and **requires no migration to enable**.

### Proposed future Postgres-only fields — NOT IMPLEMENTED OR APPLIED
```prisma
// Future add-ons, only after review of the real PostgreSQL schema:
model Question {
  // difficulty Int @default(3)     // 1–5; needs editorial calibration
  // qualityStatus String @default("unreviewed")
}
model QuizAttempt {
  // selectionMode String @default("standard")
}
model UserAnswer {
  // submittedAt DateTime?          // null for unanswered placeholders
}
```
For the actual change, insert the fields into the **existing** models (do not duplicate them), generate a reviewed migration, and backfill existing placeholder / answered rows based on reliable evidence.

## Known answer submission safety issue (release blocker for reliable mastery)
Current `PATCH /api/student/attempts/[id]/answer` can update the same `UserAnswer` repeatedly, increasing `QuestionMastery.timesSeen` for repeated submissions. A future `submittedAt` field plus an atomic `updateMany` claim (`where: { id, submittedAt: null }`) is the intended fix.

**Do not claim the duplicate-answer issue is fixed in this release.** Do not enable QAI for real student accounts until answer idempotency is addressed and tested, or mastery estimates may be misleading.

## Test checklist
1. `node --test tests/qai-smart-selector.test.mjs` — unit suite.
2. `npx tsc --noEmit` — TypeScript check.
3. With flag OFF: compare existing Smart Practice request/response, normal quizzes, answer submission, and completion.
4. With flag ON in **development only**: cold-start and experienced-student Smart Practice, correct counts, unique question IDs, no archived/draft questions, no answer key before submitting.
5. Verify that no Prisma schema files or Supabase records were modified by this code release.

## Pending work before production rollout
- Atomic answer submission, correct handling of unanswered placeholders in scoring, and regression tests.
- Official curriculum-linked concepts, reviewed difficulty tags, question-bank volume.
- End-to-end test on the owner's local PostgreSQL branch; test execution has not been verified in this environment.
- Document evaluation metrics: question repetition rate, curriculum coverage, learning improvement, and opt-out behavior.
