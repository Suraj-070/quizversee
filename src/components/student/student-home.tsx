"use client";

import { signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  LogOut,
  Settings,
  Sparkles,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";

/**
 * Phase 1 placeholder for the student home.
 * Phase 4 will replace the body with the real "available classes" grid
 * that loads from /api/student/academic.
 */
export function StudentHome({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
              <GraduationCap className="size-5" />
            </div>
            <span className="font-semibold text-slate-900">Quizverse</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 hidden sm:inline">
              {user.name}
            </span>
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
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-slate-600"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-medium mb-4">
            <Sparkles className="size-3" />
            Welcome, {user.name.split(" ")[0]}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Ready to practice?
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Pick a class, choose a subject, master the topic. Phase 1 is live —
            the academic browser arrives in Phase 4.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto"
        >
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <PlayCircle className="size-6 text-emerald-500 mb-3" />
            <h3 className="font-semibold text-slate-900">Browse classes</h3>
            <p className="text-sm text-slate-600 mt-1">
              Coming in Phase 4 — class cards will load dynamically from the
              database.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <Sparkles className="size-6 text-emerald-500 mb-3" />
            <h3 className="font-semibold text-slate-900">Take quizzes</h3>
            <p className="text-sm text-slate-600 mt-1">
              One question at a time, with smooth animations and instant
              feedback. Phase 5.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <GraduationCap className="size-6 text-emerald-500 mb-3" />
            <h3 className="font-semibold text-slate-900">Track progress</h3>
            <p className="text-sm text-slate-600 mt-1">
              Review past attempts and see your scores. Phase 6.
            </p>
          </div>
        </motion.div>

        <div className="mt-16 text-center text-xs text-slate-400">
          <p>
            Phase 1 — Foundation complete. Authentication, role system, and
            database schema are live.
          </p>
        </div>
      </main>
    </div>
  );
}
