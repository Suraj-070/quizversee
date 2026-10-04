"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  FileQuestion,
  ListChecks,
  Users,
  Settings,
  GraduationCap,
  LogOut,
  Menu,
  X,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useViewStore, type View } from "@/stores/view-store";
import { signOut } from "next-auth/react";
import type { PublicUser } from "@/types";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  view: View;
  group?: "academic" | "main";
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, view: { name: "admin-dashboard" } },
  {
    label: "Classes",
    icon: GraduationCap,
    view: { name: "admin-classes" },
    group: "academic",
  },
  {
    label: "Subjects",
    icon: BookOpen,
    view: { name: "admin-subjects" },
    group: "academic",
  },
  {
    label: "Topics",
    icon: Layers,
    view: { name: "admin-topics" },
    group: "academic",
  },
  {
    label: "Questions",
    icon: FileQuestion,
    view: { name: "admin-questions" },
  },
  {
    label: "Quiz Sets",
    icon: ListChecks,
    view: { name: "admin-quiz-sets" },
  },
  { label: "Users", icon: Users, view: { name: "admin-users" } },
  { label: "Settings", icon: Settings, view: { name: "admin-settings" } },
];

/**
 * AdminShell — sidebar + header layout for the admin portal.
 *
 * This is a layout wrapper: it renders the navigation chrome and takes
 * the page content as `children`. The student-facing portal uses a
 * completely different visual language.
 */
export function AdminShell({
  user,
  children,
}: {
  user: PublicUser;
  children: React.ReactNode;
}) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const goBack = useViewStore((s) => s.goBack);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentName = view.name;
  // Treat admin-quiz-set-detail as part of the Quiz Sets section
  const effectiveName =
    currentName === "admin-quiz-set-detail" ? "admin-quiz-sets" : currentName;
  const activeItem = NAV_ITEMS.find((i) => i.view.name === effectiveName);
  const pageTitle =
    currentName === "admin-quiz-set-detail"
      ? "Quiz Set Details"
      : activeItem?.label ?? "Admin";

  function isActive(item: NavItem) {
    return item.view.name === effectiveName;
  }

  function handleNav(item: NavItem) {
    setView(item.view);
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-800">
          <div className="size-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
            <GraduationCap className="size-5" />
          </div>
          <span className="font-semibold text-white">Quizverse Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            {NAV_ITEMS.filter((i) => !i.group).map((item) => (
              <NavButton
                key={item.label}
                item={item}
                active={isActive(item)}
                onClick={() => handleNav(item)}
              />
            ))}
          </div>

          <div className="mt-6 mb-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Academic
          </div>
          <div className="space-y-1">
            {NAV_ITEMS.filter((i) => i.group === "academic").map((item) => (
              <NavButton
                key={item.label}
                item={item}
                active={isActive(item)}
                onClick={() => handleNav(item)}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-800 p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setView({ name: "student-home" })}
          >
            <ArrowLeft className="size-4" />
            Back to student site
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
          </div>
          <div className="text-sm text-slate-600">
            <span className="hidden sm:inline">Signed in as </span>
            <span className="font-medium text-slate-900">{user.name}</span>
            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
              Admin
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <motion.div
            key={currentName}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-emerald-500 text-white"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </button>
  );
}
