# Quizverse Supabase public-schema release gate

**Status: BLOCKING — approval required before any production deployment.**
**Observed:** 2026-10-11, via read-only checks of the connected Supabase project.

## Observations

- All 17 existing application tables in `public` have Row Level Security **disabled**.
- Anonymous and authenticated Postgres roles have **SELECT and INSERT** privileges on all 17.
- This includes sensitive application tables such as `User`, `UserAnswer`,
  `QuizAttempt` and `Question`. The Supabase Data API may expose records
  independently of Quizverse's NextAuth/Prisma route protections.
- `Topic.contentType`, `Question.contentType`,
  `UserAnswer.submittedAt`, and `QuizAttempt.feedbackMode` exist in the
  current PostgreSQL database. This is **not** proof that the unpushed local
  Prisma migration branch is compatible with the UI branch.

## Proposed isolation-first remediation (NOT executed)

Quizverse uses NextAuth with Prisma server-side and has no confirmed requirement
for public direct Supabase Data API access to these application tables.
After verifying the actual runtime database role, environment, backups, and
any other Data API consumers, the preferred strategy is to **remove** unnecessary
privileges from `anon` and `authenticated`, and enable RLS on exposed tables.

Example candidate SQL for review **only**:

```sql
-- REQUIRES EXPLICIT APPROVAL. DO NOT RUN BLINDLY.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
-- Review each table's SQL policies and the Prisma database role before
-- enabling RLS on existing tables. No blanket permit-all policies.
```

A controlled migration should additionally enable RLS on each exposed table
and decide whether any narrowly scoped access policies are genuinely needed.
Do not use `USING (true)` to mask app permission failures.
Do not use the Supabase service-role key in the browser.

## Safe preflight

1. Confirm GitHub branch `migrate/supabase` is pushed and includes all intended
   Prisma/PostgreSQL files. At last check it existed only on the user's local
   machine; do not stage/overwrite their four untracked migration artifacts.
2. Record a recoverable database backup/snapshot and confirm Prisma's runtime
   role and any external Supabase Data API consumers.
3. Ask the owner to approve a specific least-privilege plan.
4. Apply an audited migration in a staging project; verify Prisma NextAuth,
   student quiz starts, answers, reviews, admin imports, and SQL privilege tests.
5. Apply production remediation only after staging approval, then re-run
   Supabase security advisors and verify no anonymous privileges remain.

## Verification SQL (read-only)

```sql
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
```

Reference: https://supabase.com/docs/guides/database/postgres/row-level-security
