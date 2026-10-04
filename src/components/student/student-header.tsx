"use client";

import { signOut } from "next-auth/react";
import {
  GraduationCap,
  LogOut,
  Settings,
  ArrowLeft,
  History,
  ListChecks,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";

/**
 * StudentHeader — shared top navigation for the student app.
 *
 * Different from the AdminShell header: this one uses light branding
 * (emerald accent) and shows student-facing actions (History, Admin link
 * if admin, Sign out).
 */
export function StudentHeader({ user }: { user: PublicUser }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const goBack = useViewStore((s) => s.goBack);

  // Show a back arrow on sub-screens (subjects, topics, etc.).
  const canGoBack =
    view.name === "student-subjects" ||
    view.name === "student-topics" ||
    view.name === "quiz-setup" ||
    view.name === "subject-quiz-setup" ||
    view.name === "quiz-set-setup" ||
    view.name === "student-history" ||
    view.name === "student-quiz-sets" ||
    view.name === "student-flagged";

  return (
    <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {canGoBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="text-slate-600"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <button
            type="button"
            onClick={() => setView({ name: "student-home" })}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="size-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
              <GraduationCap className="size-5" />
            </div>
            <span className="font-semibold text-slate-900 hidden sm:inline">
              Quizverse
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView({ name: "student-flagged" })}
            className="text-slate-600"
          >
            <Flag className="size-4" />
            <span className="hidden sm:inline">Flagged</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView({ name: "student-quiz-sets" })}
            className="text-slate-600"
          >
            <ListChecks className="size-4" />
            <span className="hidden sm:inline">Quiz Sets</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView({ name: "student-history" })}
            className="text-slate-600"
          >
            <History className="size-4" />
            <span className="hidden sm:inline">History</span>
          </Button>
          {user.role === "admin" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView({ name: "admin-dashboard" })}
              className="text-slate-600"
            >
              <Settings className="size-4" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              signOut({ redirect: false }).then(() => {
                window.location.href = "/";
              });
            }}
            className="text-slate-600"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
