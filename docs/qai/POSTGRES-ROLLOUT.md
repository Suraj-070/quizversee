# QAI answer integrity: staging branch

This branch is **NOT deployed to production**. Source branch: `qai/answer-integrity-postgres`.

## Changes staged
- `prisma/schema.prisma`: stages PostgreSQL provider and `UserAnswer.submittedAt DateTime?` (does NOT include the owner's local custom `directUrl`; reconcile rather than blindly overwrite local schema).
- `src/app/api/student/attempts/[id]/answer/route.ts`: parent-attempt row lock, one-time `submittedAt: null` claim, mastery update in the same serializable transaction, HTTP 409 on repeat submission.
- `src/app/api/student/attempts/[id]/complete/route.ts`: uses same attempt lock, counts only genuinely submitted correct answers, preserves response contract.
- `docs/qai/proposed-answer-submitted-at.postgres.sql`: additive migration, **not executed**.
- `tests/qai-answer-integrity.postgres.test.mjs`: disposable-test-database-only test of the uniqueness claim primitive (not full API integration).

## Production rollout MUST follow this order
1. Connect Supabase and inspect `public."UserAnswer"` fields/indexes (no passwords in chat).
2. Take a Supabase backup/snapshot and pause/finish in-progress quizzes before migrating.
3. Run the additive SQL **only after verifying target project and backup**; verify column and index exist.
4. Merge source changes into the owner's PostgreSQL working branch, carefully reconciling `schema.prisma`; run `npx prisma generate`.
5. Run `npx tsc --noEmit`, `node --test tests/qai-smart-selector.test.mjs`, and disposable-DB tests.
6. Test authenticated flows on staging: same answer twice, two concurrent requests, selecting A, exam mode, completion during submission, empty / partial attempts, normal topic quiz, quiz set.
7. Deploy route changes to the app. Keep `QAI_SMART_PRACTICE_V1` OFF until tests are green.

## Important limitations
- Previous in-progress quizzes have ambiguous placeholder rows. Restart them after the migration; don't infer `submittedAt` using `selectedOption` or `answeredAt`.
- Completion never changes an already completed attempt's score. Prior historical scores remain as recorded.
- Other GET endpoints may still expose answer keys on unfinished attempts and need a separate authorization/reveal review.
- Full API integration tests are **not** completed simply by adding the disposable database test; they require a staging database and running server.
- Do not promote this branch to `main` until the database migration is confirmed. Deploying the new Prisma client before its SQL migration can break reads/writes.
