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
