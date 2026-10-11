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

## Updated after verified Supabase migration
- The additive production migration `add_user_answer_submitted_at_for_qai` was applied successfully and verified against project `ioirxsnpbfrtsryxhhrv`: nullable column and index exist; 65 answer records and 2 unfinished attempts remained.
- **No app deployment has been made.**
- `src/app/api/student/attempts/route.ts` now redacts correctness, explanations, and correct options for unfinished attempts.
- `src/components/student/quiz-active.tsx` retains the submitted choice in immediate-feedback state.
- `QAI_ANSWER_ACTIVATION_AT` is a required ISO date-time for the **staged** transactional routes. Set it to the actual rollout time before deploying, never a time before the old app stopped accepting submissions. Existing unfinished pre-rollout attempts must be restarted; historical completed results remain accessible.
- `npm run test:qai` runs selector, answer-visibility, and legacy-cutoff unit tests; `npm run test:qai:postgres` runs the disposable-database test and intentionally skips without its opt-in.
- Apply PostgreSQL-specific changes to the owner's local branch only after reconciling their real schema, which may contain custom database settings absent from GitHub `main`.

## Remaining release blockers
1. Complete `npm run test:qai` and `npx tsc --noEmit` in a checkout with dependencies installed and Prisma generated **from the local PostgreSQL schema**.
2. Execute actual authenticated API integration tests in a staging server against disposable Postgres, including simultaneous submissions and completion races. The current DB-level test is insufficient to prove full route behavior.
3. Verify previously completed attempt review works and in-progress GET never contains answer keys.
4. Confirm deployment configuration and the activation cutoff; announce restarting previously unfinished attempts before enabling.
5. Keep `QAI_SMART_PRACTICE_V1` off until those checks pass.

## Low-friction GitHub verification (October 2026)
The branch now contains `.github/workflows/qai-unit-tests.yml`, with two independent GitHub Actions jobs:
- `unit-and-types`: install dependencies, generate Prisma types, run QAI unit tests and TypeScript checks.
- `disposable-postgres`: launch an **ephemeral PostgreSQL 17 container inside GitHub Actions** using database `qai_test`, create schema there, and run the guarded database integration test. It has no Supabase URL or secrets.
Check [Actions](https://github.com/Suraj-070/quizversee/actions) for a **green run** on branch `qai/answer-integrity-postgres`. Merely committing a workflow is not evidence the job passed.

This removes the need for the owner to install Docker just for the primitive PostgreSQL test. It does **not** replace a full authenticated staging-server API concurrency test, nor resolve schema differences with the owner's unpushed local `migrate/supabase` branch. Do not deploy the staged PostgreSQL routes or enable QAI solely from a green CI run.
