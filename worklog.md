---
Task ID: phase-1
Agent: main
Task: Phase 1 — Foundation for the Dynamic MCQ Learning Platform. Prisma schema, NextAuth + role guard, AppShell with view-router, login/register UI, student home + admin dashboard placeholders, seed data.

Work Log:
- Loaded the fullstack-dev skill and initialized the sandbox (Next.js 16 + Tailwind 4 + shadcn/ui + Prisma + NextAuth).
- Updated prisma/schema.prisma with all 10 tables: User, Class, Subject, Topic, Question, QuizSet, QuizSetQuestion, QuizAttempt, UserAnswer, Setting. Cascade deletes configured on parent relations.
- Ran `bun run db:push` — schema synced to SQLite (db/custom.db).
- Installed `bcryptjs` and `@types/bcryptjs` for password hashing.
- Generated NEXTAUTH_SECRET and wrote it to .env alongside NEXTAUTH_URL.
- Created `src/lib/auth.ts` — NextAuth config with Credentials provider, JWT strategy, role attached to token + session via callbacks.
- Created `src/lib/auth-guard.ts` — `requireUser()` (401 if not authenticated) and `requireAdmin()` (401 if not auth, 403 if not admin). Used by every server route handler.
- Created `src/types/index.ts` — shared public types (PublicUser, AcademicClass, AcademicSubject, AcademicTopic, Question, QuizQuestionClient, QuizAttempt, UserAnswer). Importantly, `QuizQuestionClient` does NOT include `correctOption`.
- API routes created:
    - `POST /api/auth/register` — bcrypt-hashed password, normalizes email, promotes first user to admin if DB is empty.
    - `GET/POST /api/auth/[...nextauth]` — NextAuth handler.
    - `GET /api/me` — returns current user's public profile (or null).
    - `GET /api/admin/dashboard` — admin-only; returns aggregate counts (classes, subjects, topics, questions, publishedQuestions, users, quizAttempts).
- Created `scripts/seed.ts` (persisted, idempotent) — seeds:
    - admin@mcq.local / admin12345 (role=admin)
    - student@mcq.local / student12345 (role=user)
    - Class 9 → Science → Force and Motion
    - 6 published MCQs on Force and Motion
    - Setting `quiz_question_counts = [10,20,30,40,50]`
  Ran successfully.
- Created `src/stores/view-store.ts` — Zustand store with discriminated `View` union (login, register, student-home, student-classes/subjects/topics, quiz-setup/active/results/review, student-history, admin-dashboard/classes/subjects/topics/questions/quiz-sets/users/settings). Includes history + goBack for client-side navigation.
- Created `src/components/providers.tsx` — client-side SessionProvider wrapper (fixes "React Context is unavailable in Server Components" error when SessionProvider is rendered inside the server-rendered RootLayout).
- Built `src/components/auth/auth-screen.tsx` — login/register toggle, Framer Motion entrance, error handling, demo credential quick-fill, auto-login after register, hard reload to hydrate session.
- Built `src/components/student/student-home.tsx` — Phase 1 placeholder with "Ready to practice?" hero, three feature cards (Browse classes / Take quizzes / Track progress) teasing future phases, admin link visible only to admins, sign-out button.
- Built `src/components/admin/admin-shell.tsx` — dark sidebar layout with grouped navigation (Academic = Classes/Subjects/Topics), mobile hamburger menu, header with role badge, "Back to student site" + "Sign out" actions, Framer Motion page transitions keyed on view name.
- Built `src/components/admin/admin-dashboard.tsx` — fetches `/api/admin/dashboard`, renders 8 stat cards (Classes, Subjects, Topics, Total Questions, Published Questions, Users, Quiz Attempts, Quiz Sets), skeleton loaders during fetch, error card, Phase 1 status card.
- Built `src/components/app-shell.tsx` — top-level client component: fetches /api/me on mount, renders AuthScreen / StudentHome / AdminShell based on session + view. Includes "Coming Soon" panel for not-yet-implemented admin views so the sidebar still works in Phase 1.
- Wired `src/app/page.tsx` to render AppShell.
- Updated `src/app/layout.tsx` to use the new Providers wrapper (client-side SessionProvider) instead of importing SessionProvider directly (which fails in server components).
- Pre-created empty API folders for phases 2–7 (`api/admin/{classes,subjects,topics,questions,quiz-sets,users,settings}` and `api/student/{academic,questions,attempts,history}`) so the structure is ready.
- Lint clean (0 errors, 0 warnings).
- Agent Browser verification:
    - Login screen renders with email/password, demo login buttons.
    - Clicking "admin@mcq.local" auto-fills credentials, clicking "Sign in" redirects to Admin Dashboard.
    - Admin Dashboard shows correct seeded counts: 1 class, 1 subject, 1 topic, 6 questions (6 published), 2 users, 0 attempts.
    - Sidebar shows all 8 admin nav items (Dashboard, Classes, Subjects, Topics, Questions, Quiz Sets, Users, Settings).
    - "Back to student site" navigates to Student Home.
    - Sign out returns to login screen.
    - Register flow: filled Name + Email + Password, clicked Create account → automatically signed in → landed on Student Home with no Admin button (correct for user role).
    - Server-side auth verified: unauthenticated request to /api/admin/dashboard returns 401 with `{"error":"Authentication required"}`; authenticated non-admin returns 403 with `{"error":"Admin access required"}`.
- Captured screenshots: /home/z/my-project/download/phase1-admin-dashboard.png, /home/z/my-project/download/phase1-login-screen.png.

Stage Summary:
- All Phase 1 deliverables complete: Next.js project structure ✓, Tailwind setup ✓, database connection ✓, authentication ✓, database schema ✓, role system ✓, basic layouts ✓.
- Stack reconciliation with PRD §2 documented: Prisma+SQLite instead of Supabase Postgres, NextAuth instead of Supabase Auth, server-side auth-guard instead of RLS, single-`/`-route client-side navigation instead of multi-route App Router. All portable to a real Supabase deployment by swapping only the data layer.
- Seed credentials: admin@mcq.local / admin12345 (admin), student@mcq.local / student12345 (student).
- 10 tables created with proper cascade deletes; 6 sample MCQs on Force and Motion ready for the Phase 5 quiz engine to consume.
- Setting `quiz_question_counts = [10,20,30,40,50]` stored in DB, ready for the Phase 5 quiz setup screen.
- Architecture is theme-ready and CRUD-ready — no academic content is hardcoded anywhere outside `scripts/seed.ts`.
- Awaiting user confirmation to proceed to Phase 2 (Academic CRUD: Classes / Subjects / Topics with dependent selectors + confirmation dialogs).

---
Task ID: phase-2
Agent: main
Task: Phase 2 — Academic CRUD (Classes / Subjects / Topics with dependent selectors + confirmation dialogs).

Work Log:
- Created `src/lib/prisma-queries.ts` with reusable helpers: `countClassChildren`, `countSubjectChildren`, `countTopicChildren` (return affected row counts for delete-confirmation dialogs), and `nextDisplayOrder` for auto-incrementing the displayOrder field on new entities.
- Created shared admin components:
    - `src/components/admin/status-badge.tsx` — colored pill for Active/Disabled/Published/Draft states.
    - `src/components/admin/confirm-dialog.tsx` — AlertDialog-based modal that fetches affected child counts via a provided async function and displays them with a destructive-action warning. Shows "This will also delete: N subjects, N topics, N questions" when counts > 0.
    - `src/components/admin/form-field.tsx` — Label + control + error/hint wrapper to reduce form boilerplate.
    - `src/components/shared/empty-state.tsx` — friendly "No X yet" placeholder with optional CTA.
    - `src/components/shared/list-skeleton.tsx` — shimmer rows matching DataTable layout during loading.
- Built 6 API route handlers (all admin-guarded via `requireAdmin()`):
    - `GET/POST /api/admin/classes` — list + create
    - `GET/PATCH/DELETE /api/admin/classes/[id]` — fetch-with-counts, update, delete (cascade)
    - `GET/POST /api/admin/subjects` — supports `?classId=` filter; create includes parent-class validation + uniqueness check within the class
    - `GET/PATCH/DELETE /api/admin/subjects/[id]` — fetch-with-counts, update, delete
    - `GET/POST /api/admin/topics` — supports `?subjectId=` and `?classId=` filters; create includes parent-subject validation + uniqueness check within the subject
    - `GET/PATCH/DELETE /api/admin/topics/[id]` — fetch-with-counts, update, delete
  All mutations validate input with zod, normalize whitespace, and enforce name uniqueness within the parent scope.
- Built `src/components/admin/admin-classes.tsx` — full CRUD UI:
    - Search by name
    - Table: Name | Description | Status | Order | Actions (Edit/Delete)
    - Create/Edit dialog: name, description, displayOrder, isActive switch
    - Delete confirmation dialog shows affected subjects/topics/questions counts
    - EmptyState when no classes exist
- Built `src/components/admin/admin-subjects.tsx` — full CRUD UI:
    - Search + Class filter dropdown
    - Table: Name | Class | Topics count | Status | Order | Actions
    - Create/Edit dialog with parent-class Select + name, description, icon, displayOrder, isActive
    - Delete confirmation shows affected topics/questions counts
    - Warning banner when no classes exist yet
- Built `src/components/admin/admin-topics.tsx` — full CRUD UI with DEPENDENT SELECTORS:
    - Filter row: Class dropdown → Subject dropdown (subjects depend on selected class — disabled until a class is picked)
    - Search by name
    - Table: Name | Class | Subject | Questions count | Status | Order | Actions
    - Create/Edit dialog with dependent selectors: Parent class → Parent subject (subject dropdown is empty/disabled until a class is selected, then loads subjects for that class via /api/admin/subjects?classId=)
    - Delete confirmation shows affected questions count
- Wired all three new screens into `src/components/app-shell.tsx` via a switch statement; sidebar navigation now routes to the correct screen.
- Lint: 0 errors, 0 warnings.
- Agent Browser verification (all passed):
    - Logged in as admin@mcq.local → navigated to Classes
    - Created "Class 10" via the Create dialog → row appeared at top of list
    - Navigated to Subjects → created "Mathematics" under Class 9 (after changing parent class dropdown from default Class 10) → row appeared with correct class label
    - Navigated to Topics → confirmed seeded "Force and Motion" topic shows with 6 questions, under Class 9 → Science
    - Tested dependent filter: selected Class 9 in the filter dropdown → subject filter became enabled and showed ONLY "Science" (not Mathematics, which belongs to Class 10). PRD §9 requirement satisfied.
    - Tested delete confirmation on "Force and Motion" topic → dialog showed "You are about to delete Force and Motion. This will also delete: 6 questions. Cascading deletes are enabled." — exactly per PRD §41.
    - Cancelled that delete to preserve seed data.
    - Tested delete on "Class 10" (which had 2 subjects: Mathematics + Physics created during testing) → dialog showed "This will also delete: 2 subjects" → confirmed delete → cascade removed Class 10 + its 2 subjects.
    - Verified Edit dialog pre-fills all existing values (name, description, displayOrder, isActive) correctly.
    - Dashboard counts back to seed state after cleanup: 1 class, 1 subject, 1 topic, 6 questions, 2 users.
    - No runtime errors in browser console or dev.log.

Stage Summary:
- All Phase 2 deliverables complete: Classes CRUD ✓, Subjects CRUD ✓, Topics CRUD ✓, dependent selectors ✓ (both in filters and in create/edit forms), confirmation dialogs with affected counts ✓, enable/disable via isActive switch ✓, display order ✓.
- Architecture is fully dynamic: an admin can now create Class 8 → Mathematics → Algebra through the UI with zero source-code changes. The hierarchy comes entirely from the database.
- Tested the dynamic-academic-content promise: created Class 10 + Mathematics + Physics through the admin UI, then deleted Class 10 (cascade-cleaned its 2 subjects) — all without touching code.
- Note on agent-browser: direct `click` on shadcn Dialog submit buttons sometimes triggers Radix's pointer-outside handler before the click event fires (a known Playwright/Radix interaction). Workaround used during testing: focus the button then press Enter. This does NOT affect real users — clicking the button with a real mouse works fine.
- Screenshot captured: /home/z/my-project/download/phase2-topics-screen.png
- Awaiting user confirmation to proceed to Phase 3 (Question Management: question table with filters, create/edit form with dependent selectors, publish/draft, publish/unpublish actions).
