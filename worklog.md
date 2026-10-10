# Quizverse Worklog — Question Publishing UX + Large Dataset Imports

---
Task ID: 0
Agent: main
Task: Inspect repository and verify production SQLite storage before any changes.

Work Log:
- Read package.json: Next.js 16, Prisma 6, SQLite, NextAuth, no Supabase/Postgres.
- Read prisma/schema.prisma: full data model. Question has status (draft|published), contentType (curriculum|extra_practice), sourceType/sourceName/sourceQuestionId/sourceLicense/suitableLevels.
- Read src/components/admin/admin-questions.tsx (1014 lines): root cause of perceived "page refresh" identified — togglePublish() calls await load() which sets loading=true, refetches ALL questions from /api/admin/questions, and replaces the questions array. No window.location.reload() present, but the visual effect (skeleton → repopulate) feels like a refresh.
- Read src/app/api/admin/questions/route.ts and [id]/route.ts: standard PATCH endpoint, no bulk support.
- Read src/components/admin/admin-imports.tsx: import flow already validates and inserts as status="published" directly. No "batch" grouping, no draft staging for JSON imports.
- Read scripts/import-nepal-dataset.ts: HF dataset fetch with LLM conversion. Imports as draft. Idempotent via sourceQuestionId check. Capped at 200 records / 30 MCQs.
- Read .zscripts/build.sh and database-runtime-build.sh: build pipeline COPIES preview DB (db/custom.db) into the build artifact. Persistence across redeployments depends on whether /home/z/my-project/db/custom.db survives rebuilds.
- Inspected live DB: 291 questions (267 published curriculum, 24 draft Nepal imports). ImportHistory table is empty (Nepal script doesn't record history). Only auto-indexes exist — no indexes on Question.status, topicId, sourceType, sourceQuestionId, contentType.

Stage Summary:
- Stack confirmed: Next.js 16 + Prisma + SQLite + NextAuth. No Supabase.
- Root cause of perceived refresh: full refetch after PATCH, not actual navigation.
- DB has 291 questions; needs additive indexes + a new optional importBatchId column for batch-level operations.
- Persistence risk: production data MIGHT be overwritten by preview DB on redeploy. Must warn user and create a backup before any large import.

---
Task ID: G
Agent: main
Task: Verify z.ai SQLite persistence.

Work Log:
- Read .zscripts/build.sh + database-runtime-build.sh + start.sh.
- Build pipeline behavior:
  - SOURCE_DB = /home/z/my-project/db/custom.db (preview/workspace DB)
  - On `bun run build`, `database-runtime-build.sh` COPIES preview DB → /tmp/build_fullstack_*/db/custom.db (build artifact).
  - If preview DB does NOT exist, an empty DB is created in the build artifact via `bun run db:push`.
  - Build artifact is tarred and extracted into /app/ in production.
  - start.sh sets DATABASE_URL=file:/app/db/custom.db by default.
- Sandbox inspection: /home/z/my-project/db/custom.db IS the live DB being written by `bun run dev` (mtime updated continuously). /app/ is root-owned, separate from preview.
- Production data NOT in /home/z/my-project/db/custom.db would be OVERWRITTEN by preview DB on the next deploy.
- Data written in preview (this env) DOES survive `bun run dev` restarts because the file is persistent in /home/z/my-project/db/.
- However: if production adds rows (e.g., student quiz attempts via /app/db/custom.db), those rows DO NOT sync back to preview, and are LOST on next redeploy.

Persistence Verdict:
- Within a single preview environment: PERSISTENT across dev restarts.
- Across redeployments to production: PRODUCTION DATA IS OVERWRITTEN by preview DB on every build.
- Multiple app instances: SQLite is a single-file DB; safe only if a single process writes. Next.js standalone server is single-process; OK.
- Backups: no automated backup mechanism in place.

Safe Path Forward:
- Created manual backup at /home/z/my-project/db/backups/custom.db.pre-bulk-publish-20261010T150824Z (verified: 291 questions, 3 users, 5 attempts).
- Recommendation: before any large import, run a backup using SQLite Online Backup API (sqlite3 .backup command via Prisma's raw interface) to a timestamped file. Documented in scripts/db-backup.ts.
- Long-term recommendation: configure DATABASE_URL in production to point at a persistent volume path OUTSIDE /app (e.g., /data/quizverse.db) so redeployments don't overwrite live data. REQUIRES USER APPROVAL — do not change without confirmation.
- Did NOT migrate databases. Did NOT change DATABASE_URL. Did NOT touch production config.

Stage Summary:
- Persistence verified within preview env. Across redeploy: NO GUARANTEE — preview overwrites production.
- Backup created and verified. Safe to proceed with code changes.
- User will be warned before any large dataset import (>500 records).

---
Task ID: A-F (Implementation)
Agent: main
Task: Implement all code changes — fix page refresh, bulk selection, bulk publish endpoint, Import Center batches, large-batch Nepal importer, SQLite optimization.

Work Log:
- Schema: added importBatchId (nullable String) column + 7 new indexes (status, topicId, contentType, status+contentType, sourceType+sourceQuestionId, sourceName, importBatchId, createdAt) to Question model. Applied via `bun run db:push` (additive — no data loss).
- Backup utility: scripts/db-backup.ts uses SQLite VACUUM INTO for transactionally consistent snapshots. Verified with 291 questions / 3 users / 5 attempts.
- TASK A (no-refresh publish): rewrote togglePublish in admin-questions.tsx to use optimistic local state updates instead of `await load()`. After successful PATCH, the row is replaced in place using the server's authoritative response. On error, state is rolled back. Scroll position, filters, page, sorting, and selection are all untouched.
- TASK B (bulk selection): added Checkbox column to table, header-level "select all on page" checkbox, "Select all N matching across pages" prompt when total > page size, persistent selection via Set<id> that survives page navigation, "Clear" button, scope indicator ("X selected on this page" vs "All N matching questions selected across all pages").
- TASK C (bulk publish endpoint): created src/lib/bulk-publish.ts (shared library) + POST /api/admin/questions/bulk-publish. Accepts either explicit questionIds (max 5000) or a server-side filter spec. Validates each question (non-empty text + 4 options + correctOption in A/B/C/D). Returns partial-success report: selected, published, unpublished, alreadyTarget, notFound, needsReview, failed, failures[]. Uses chunked updateMany (500 IDs per chunk) with WHERE status != target for idempotent concurrent operations. SQLite busy/locked errors trigger per-id fallback. Single AdminActivity entry per bulk op.
- TASK D (Import Center bulk publish): added "Import Batches" section to admin-imports.tsx showing per-batch counts (total/drafts/published/invalid). Per-batch actions: View All, View Invalid, Publish All Valid Drafts. Detail dialog with checkbox selection per question (invalid questions are checkbox-disabled). Bulk-publish confirmation dialog with explicit scope. "Import as draft" toggle on the JSON upload flow — when checked, questions are inserted as draft + tagged with importBatchId. New API endpoints: GET /api/admin/imports/batches, POST /api/admin/imports/batches/bulk-publish, GET /api/admin/imports/batches/[batchId]/questions?filter=all|invalid|duplicates.
- TASK E (Nepal v2 importer): created scripts/import-nepal-dataset-v2.ts with CLI args (maxRecords, maxMcqs), HF API pagination with bounded retry + exponential backoff (200ms→400ms→800ms→...→5s cap, max 4 retries), pacing (200ms between calls), resume-after-interruption (state file at scripts/.nepal-import-state/progress.json tracking importBatchId + lastOffset + processedSourceIds[]), idempotent re-runs via DB-side sourceQuestionId check, importBatchId stamped on every inserted question, ImportHistory entry written at end of run. All questions imported as draft for admin review. No fake data — only real LLM-converted MCQs are inserted.
- TASK F (SQLite perf): added 7 indexes (above), server-side pagination in GET /api/admin/questions (default page=1, pageSize=50, max 200). Returns total count so client can render "All N matching". Admin UI no longer loads thousands of full records — uses skip/take pagination.
- TASK H (student experience): no changes to any student component, API, or DB query. Verified GET /api/student/questions returns 401 (auth-gated, unchanged), 267 published curriculum questions remain available, 5 attempts + 50 answers preserved.

Testing:
- Created scripts/test-bulk-publish.ts with 17 test scenarios.
- Result: 17/17 PASS. Test data is fully cleaned up between tests (verified 0 leftover test rows after run).
- Pre-test backup: db/backups/custom.db.pre-tests (291 questions verified).
- Post-implementation backup: db/backups/custom.db.post-implementation (291 questions verified).
- DB state before and after the test suite: identical (291 questions, 267 published, 24 draft, 3 users, 5 attempts, 50 answers, 3 classes, 7 subjects, 34 topics).

Stage Summary:
- All Tasks A-I complete and verified.
- No production data was modified or lost.
- Backup infrastructure in place (manual trigger via scripts/db-backup.ts).
- 17/17 automated tests passing.
- DB schema is backward-compatible (all new fields are nullable, all new indexes are additive).
- Student experience 100% unchanged.
