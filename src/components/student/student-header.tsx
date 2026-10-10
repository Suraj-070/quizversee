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
  TrendingUp,
  UserCircle,
  BookOpen,
  Dumbbell,
  Compass,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { cn } from "@/lib/utils";

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
    view.name === "student-flagged" ||
    view.name === "student-progress" ||
    view.name === "student-profile" ||
    view.name === "my-learning" ||
    view.name === "extra-practice" ||
    view.name === "explore";

  return (
    <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-md sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
        {/* Left: Logo + Back */}
        <div className="flex items-center gap-2 shrink-0">
          {canGoBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <button
            type="button"
            onClick={() => setView({ name: "student-home" })}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="size-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
              <GraduationCap className="size-4" />
            </div>
            <span className="font-semibold text-slate-900 text-sm hidden sm:inline">
              Quizverse
            </span>
          </button>
        </div>

        {/* Center: Primary navigation (hidden on mobile) */}
        <nav className="hidden md:flex items-center gap-0.5">
          <NavButton view="my-learning" current={view.name} setView={setView} icon={BookOpen} label="My Learning" show="md" />
          <NavButton view="extra-practice" current={view.name} setView={setView} icon={Dumbbell} label="Practice" show="md" />
          <NavButton view="explore" current={view.name} setView={setView} icon={Compass} label="Explore" show="lg" />
        </nav>

        {/* Right: Account + secondary */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setView({ name: "student-history" })} className="text-slate-500" title="History">
            <History className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setView({ name: "student-progress" })} className="text-slate-500" title="Progress">
            <TrendingUp className="size-4" />
          </Button>
          {user.role === "admin" && (
            <Button variant="ghost" size="icon" onClick={() => setView({ name: "admin-dashboard" })} className="text-slate-500" title="Admin">
              <Settings className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setView({ name: "student-profile" })} className="text-slate-500" title="Profile">
            <UserCircle className="size-4" />
          </Button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              signOut({ redirect: false }).then(() => {
                window.location.href = "/";
              });
            }}
            className="text-slate-400 hover:text-red-500"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      {/* Mobile nav: compact primary tabs */}
      <div className="md:hidden border-t border-slate-100 px-2 py-1.5 flex items-center justify-around">
        <MobileNavButton view="my-learning" current={view.name} setView={setView} icon={BookOpen} label="Learn" />
        <MobileNavButton view="extra-practice" current={view.name} setView={setView} icon={Dumbbell} label="Practice" />
        <MobileNavButton view="explore" current={view.name} setView={setView} icon={Compass} label="Explore" />
        <MobileNavButton view="student-home" current={view.name} setView={setView} icon={Home} label="Home" />
      </div>
    </header>
  );
}

function NavButton({ view, current, setView, icon: Icon, label, show }: {
  view: string;
  current: string;
  setView: (v: View) => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  show: "md" | "lg";
}) {
  const isActive = current === view;
  return (
    <button
      type="button"
      onClick={() => setView({ name: view as View["name"] } as View)}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-emerald-50 text-emerald-700"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
      )}
    >
      {label}
    </button>
  );
}

function MobileNavButton({ view, current, setView, icon: Icon, label }: {
  view: string;
  current: string;
  setView: (v: View) => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  const isActive = current === view;
  return (
    <button
      type="button"
      onClick={() => setView({ name: view as View["name"] } as View)}
      className={cn(
        "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
        isActive ? "text-emerald-600" : "text-slate-400"
      )}
    >
      <Icon className="size-4" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
