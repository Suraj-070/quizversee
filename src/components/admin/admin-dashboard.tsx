"use client";

import { useEffect, useState } from "react";
import {
  GraduationCap,
  BookOpen,
  Layers,
  FileQuestion,
  Users,
  ListChecks,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PublicUser } from "@/types";

/**
 * Admin Dashboard — Phase 1 placeholder.
 *
 * Real summary cards (counts of classes / subjects / topics / questions /
 * users / quiz attempts) will be wired up in Phases 2–6 as those entities
 * become available. For Phase 1, the dashboard fetches live counts from
 * the database via /api/admin/dashboard to verify the data layer works.
 */

type DashboardStats = {
  classes: number;
  subjects: number;
  topics: number;
  questions: number;
  publishedQuestions: number;
  draftQuestions: number;
  users: number;
  quizAttempts: number;
  quizAttemptsToday: number;
  quizSets: number;
  publishedQuizSets: number;
  avgScore: number;
  recentActivity: Array<{
    id: string;
    description: string;
    action: string;
    createdAt: string;
    adminName: string | null;
  }>;
};

export function AdminDashboard({ user: _user }: { user: PublicUser }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/dashboard");
        if (!res.ok) {
          throw new Error(`Failed to load dashboard (${res.status})`);
        }
        const data = (await res.json()) as DashboardStats;
        if (!cancelled) {
          setStats(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-sm text-slate-600 mt-1">
          Overview of your MCQ platform. Real CRUD screens arrive in Phases 2–3.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Classes"
          icon={GraduationCap}
          value={stats?.classes}
          loading={loading}
          color="emerald"
        />
        <StatCard
          label="Total Subjects"
          icon={BookOpen}
          value={stats?.subjects}
          loading={loading}
          color="sky"
        />
        <StatCard
          label="Total Topics"
          icon={Layers}
          value={stats?.topics}
          loading={loading}
          color="violet"
        />
        <StatCard
          label="Total Questions"
          icon={FileQuestion}
          value={stats?.questions}
          loading={loading}
          color="amber"
        />
        <StatCard
          label="Published Questions"
          icon={CheckCircle2}
          value={stats?.publishedQuestions}
          loading={loading}
          color="emerald"
        />
        <StatCard
          label="Total Users"
          icon={Users}
          value={stats?.users}
          loading={loading}
          color="rose"
        />
        <StatCard
          label="Quiz Attempts"
          icon={TrendingUp}
          value={stats?.quizAttempts}
          loading={loading}
          color="sky"
          hint={stats ? `${stats.quizAttemptsToday} today` : undefined}
        />
        <StatCard
          label="Quiz Sets"
          icon={ListChecks}
          value={stats?.quizSets}
          loading={loading}
          color="violet"
          hint={stats ? `${stats.publishedQuizSets} published` : undefined}
        />
        <StatCard
          label="Avg Score"
          icon={TrendingUp}
          value={stats?.avgScore !== undefined ? `${stats.avgScore}%` : undefined}
          loading={loading}
          color="emerald"
        />
      </div>

      {/* Recent Activity */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-sm">
                <span className="size-2 mt-1.5 rounded-full bg-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900">{a.description}</p>
                  <p className="text-xs text-slate-400">
                    {a.adminName ?? "System"} ·{" "}
                    {new Date(a.createdAt).toLocaleString(undefined, {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="text-sm text-red-700 py-4">
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            ✅ All core modules are live: Classes, Subjects, Topics, Questions,
            Quiz Sets, Quiz Engine, Results, Review, History.
          </p>
          <p>
            ✅ Authentication + role enforcement via NextAuth + bcrypt. Roles
            (<code>user</code> / <code>admin</code>) stored on the User record
            and enforced server-side via <code>requireAdmin()</code>.
          </p>
          <p>
            ✅ Architecture is fully dynamic — adding a new class, subject,
            topic, question, or quiz set through the Admin Portal requires
            <strong> zero source-code changes</strong>.
          </p>
          <p>
            ✅ Quiz engine is theme-ready (PRD §24) — the{" "}
            <code>quiz-themes.ts</code> registry ships one default theme. Adding
            Focus / Chill / Arcade themes is a single registry entry.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700",
  rose: "bg-rose-100 text-rose-700",
};

function StatCard({
  label,
  icon: Icon,
  value,
  loading,
  color,
  hint,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number | undefined;
  loading: boolean;
  color: keyof typeof COLOR_MAP;
  hint?: string;
}) {
  return (
    <Card className="overflow-hidden shadow-card transition-shadow hover:shadow-card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {label}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-2" />
            ) : (
              <p className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
                {value ?? 0}
              </p>
            )}
            {hint && (
              <p className="text-xs text-slate-400 mt-1">{hint}</p>
            )}
          </div>
          <div
            className={`size-10 rounded-lg flex items-center justify-center ${
              COLOR_MAP[color]
            }`}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
