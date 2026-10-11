"use client";

import { useEffect, useState } from "react";
import type { PublicUser } from "@/types";
import { AuthScreen } from "@/components/auth/auth-screen";
import { AcademicOnboarding } from "@/components/student/academic-onboarding";
import { StudentHome } from "@/components/student/student-home";
import { MyLearning } from "@/components/student/my-learning";
import { ExtraPractice } from "@/components/student/extra-practice";
import { Explore } from "@/components/student/explore";
import { StudentSubjects } from "@/components/student/student-subjects";
import { StudentTopics } from "@/components/student/student-topics";
import { StudentHeader } from "@/components/student/student-header";
import { QuizSetup } from "@/components/student/quiz-setup";
import { SubjectQuizSetup } from "@/components/student/subject-quiz-setup";
import { QuizActive } from "@/components/student/quiz-active";
import { QuizResults } from "@/components/student/quiz-results";
import { QuizReview } from "@/components/student/quiz-review";
import { StudentHistory } from "@/components/student/student-history";
import { StudentQuizSets } from "@/components/student/student-quiz-sets";
import { QuizSetSetup } from "@/components/student/quiz-set-setup";
import { StudentFlagged } from "@/components/student/student-flagged";
import { StudentProgress } from "@/components/student/student-progress";
import { StudentProfile } from "@/components/student/student-profile";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminClasses } from "@/components/admin/admin-classes";
import { AdminSubjects } from "@/components/admin/admin-subjects";
import { AdminTopics } from "@/components/admin/admin-topics";
import { AdminQuestions } from "@/components/admin/admin-questions";
import { AdminQuizSets } from "@/components/admin/admin-quiz-sets";
import { AdminQuizSetDetail } from "@/components/admin/admin-quiz-set-detail";
import { AdminUsers } from "@/components/admin/admin-users";
import { AdminUserDetail } from "@/components/admin/admin-user-detail";
import { AdminSettings } from "@/components/admin/admin-settings";
import { AdminImports } from "@/components/admin/admin-imports";
import { AdminAnnouncements } from "@/components/admin/admin-announcements";
import { AdminActivityLog } from "@/components/admin/admin-activity-log";
import { AdminAnalytics } from "@/components/admin/admin-analytics";
import { AdminAttempts } from "@/components/admin/admin-attempts";
import { AdminArchive } from "@/components/admin/admin-archive";
import { AdminSiteContent } from "@/components/admin/admin-site-content";
import { useViewStore } from "@/stores/view-store";
import { Loader2 } from "lucide-react";

/**
 * AppShell — top-level client component.
 *
 * Responsibilities:
 *   1. Fetch the current user (via /api/me) on mount.
 *   2. If unauthenticated → render AuthScreen (login/register).
 *   3. If authenticated as user → render Student app.
 *   4. If authenticated as admin → allow access to both Student + Admin.
 *   5. Branch the student/admin sub-views via the view-store.
 *
 * The sandbox exposes a single Next.js route (`/`), so all "navigation"
 * between screens happens client-side through useViewStore. The view
 * discriminator mirrors what an App Router version would look like.
 */
export function AppShell() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(true);
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) throw new Error(`me failed: ${res.status}`);
        const data = (await res.json()) as {
          user: (PublicUser & {
            onboardingCompleted: boolean;
            currentClassId: string | null;
          }) | null;
        };
        if (!cancelled) {
          setUser(data.user);
          if (data.user) {
            // Never force quiz navigation on reload; offer explicit resume on Home.
            if (
              data.user.role === "user" &&
              !data.user.onboardingCompleted
            ) {
              // Student hasn't completed academic onboarding → show onboarding
              setView({ name: "onboarding" });
            } else {
              // On a fresh load, default admins to the admin dashboard
              // and regular users to the student home.
              setView(
                data.user.role === "admin"
                  ? { name: "admin-dashboard" }
                  : { name: "student-home" }
              );
            }
          } else {
            setView({ name: "login" });
          }
        }
      } catch (err) {
        console.error("[AppShell] bootstrap failed", err);
        if (!cancelled) setView({ name: "login" });
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [setView]);

  // Booting state — show a centered spinner while /api/me resolves.
  if (booting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
        <p className="text-sm text-slate-500 mt-3">Loading Quizverse…</p>
      </div>
    );
  }

  // Not authenticated → AuthScreen (login or register).
  if (!user) {
    return <AuthScreen />;
  }

  // If the view is onboarding, render the onboarding flow
  // (only for non-admin students who haven't completed setup).
  if (view.name === "onboarding") {
    return <AcademicOnboarding user={user} />;
  }

  // Authenticated. Decide which surface to render.
  // Admin views are only reachable if user.role === 'admin'.
  const isAdminView = view.name.startsWith("admin-");
  if (isAdminView && user.role !== "admin") {
    // Safety: client should never route a non-admin here, but if it happens,
    // fall back to student home.
    return <StudentHome user={user} />;
  }

  if (isAdminView) {
    // Phase 2 implements admin-dashboard, admin-classes, admin-subjects,
    // and admin-topics. Other admin views (questions, quiz-sets, users,
    // settings) arrive in later phases.
    let content: React.ReactNode;
    switch (view.name) {
      case "admin-dashboard":
        content = <AdminDashboard user={user} />;
        break;
      case "admin-classes":
        content = <AdminClasses />;
        break;
      case "admin-subjects":
        content = <AdminSubjects />;
        break;
      case "admin-topics":
        content = <AdminTopics />;
        break;
      case "admin-questions":
        content = <AdminQuestions />;
        break;
      case "admin-quiz-sets":
        content = <AdminQuizSets />;
        break;
      case "admin-quiz-set-detail": {
        const qsId = view.name === "admin-quiz-set-detail" ? view.quizSetId : "";
        content = <AdminQuizSetDetail quizSetId={qsId} />;
        break;
      }
      case "admin-users":
        content = <AdminUsers />;
        break;
      case "admin-user-detail": {
        const uId = view.name === "admin-user-detail" ? view.userId : "";
        content = <AdminUserDetail userId={uId} />;
        break;
      }
      case "admin-settings":
        content = <AdminSettings />;
        break;
      case "admin-imports":
        content = <AdminImports />;
        break;
      case "admin-announcements":
        content = <AdminAnnouncements />;
        break;
      case "admin-activity-log":
        content = <AdminActivityLog />;
        break;
      case "admin-analytics":
        content = <AdminAnalytics />;
        break;
      case "admin-attempts":
        content = <AdminAttempts />;
        break;
      case "admin-archive":
        content = <AdminArchive />;
        break;
      case "admin-site-content":
        content = <AdminSiteContent />;
        break;
      default:
        content = <ComingSoon label={view.name} />;
    }
    return <AdminShell user={user}>{content}</AdminShell>;
  }

  // Student views — Phases 4–6 implement the full student flow.
  switch (view.name) {
    case "student-subjects":
      return <StudentSubjects user={user} />;
    case "student-topics":
      return <StudentTopics user={user} />;
    case "quiz-setup":
      return <QuizSetup user={user} />;
    case "subject-quiz-setup":
      return <SubjectQuizSetup user={user} />;
    case "quiz-set-setup":
      return <QuizSetSetup user={user} />;
    case "quiz-active":
      return <QuizActive user={user} />;
    case "quiz-results":
      return <QuizResults user={user} />;
    case "quiz-review":
      return <QuizReview user={user} />;
    case "student-history":
      return <StudentHistory user={user} />;
    case "student-quiz-sets":
      return <StudentQuizSets user={user} />;
    case "student-flagged":
      return <StudentFlagged user={user} />;
    case "student-progress":
      return <StudentProgress user={user} />;
    case "student-profile":
      return <StudentProfile user={user} />;
    case "my-learning":
      return <MyLearning user={user} />;
    case "extra-practice":
      return <ExtraPractice user={user} />;
    case "explore":
      return <Explore user={user} />;
    case "student-home":
    default:
      return <StudentHome user={user} />;
  }
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-slate-700">
        “{label}” — coming in a later phase.
      </p>
      <p className="text-xs text-slate-500 mt-2">
        The sidebar is live and ready. The actual screen content ships in
        the next development phase.
      </p>
    </div>
  );
}
