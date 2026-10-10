"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Target,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useViewStore } from "@/stores/view-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UserInfo = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};

type AttemptInfo = {
  id: string;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  startedAt: string;
  completedAt: string | null;
  topic: {
    id: string;
    name: string;
    subject: {
      id: string;
      name: string;
      class: { id: string; name: string };
    };
  } | null;
  subject: {
    id: string;
    name: string;
    class: { id: string; name: string };
  } | null;
  quizSet: {
    id: string;
    name: string;
    class: { id: string; name: string };
  } | null;
};

export function AdminUserDetail({ userId }: { userId: string }) {
  const setView = useViewStore((s) => s.setView);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [attempts, setAttempts] = useState<AttemptInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}/attempts`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load user data");
        const data = (await res.json()) as {
          user: UserInfo;
          attempts: AttemptInfo[];
        };
        if (cancelled) return;
        setUser(data.user);
        setAttempts(data.attempts);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView({ name: "admin-users" })}
        >
          <ArrowLeft className="size-4" />
          Back to users
        </Button>
        <EmptyState
          icon={AlertTriangle}
          title="User not found"
          description={error ?? "This user may have been deleted."}
        />
      </div>
    );
  }

  const completed = (attempts ?? []).filter((a) => a.completedAt);
  const avgScore =
    completed.length > 0
      ? completed.reduce((s, a) => s + a.scorePercentage, 0) / completed.length
      : 0;
  const totalCorrect = completed.reduce(
    (s, a) => s + a.correctAnswers,
    0
  );
  const totalQuestions = completed.reduce(
    (s, a) => s + a.totalQuestions,
    0
  );

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setView({ name: "admin-users" })}
      >
        <ArrowLeft className="size-4" />
        Back to users
      </Button>

      {/* User header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "size-14 rounded-xl flex items-center justify-center text-white shrink-0",
              user.role === "admin"
                ? "bg-gradient-to-br from-amber-400 to-orange-500"
                : "bg-gradient-to-br from-emerald-400 to-teal-500"
            )}
          >
            <span className="text-xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
            <p className="text-sm text-slate-500">{user.email}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Joined{" "}
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              user.role === "admin"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
            )}
          >
            {user.role === "admin" ? "Admin" : "Student"}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Total Attempts"
          value={completed.length}
          color="sky"
        />
        <StatCard
          icon={TrendingUp}
          label="Average Score"
          value={`${Math.round(avgScore)}%`}
          color={avgScore >= 70 ? "emerald" : avgScore >= 40 ? "amber" : "rose"}
        />
        <StatCard
          icon={Target}
          label="Correct Answers"
          value={totalCorrect}
          color="emerald"
        />
        <StatCard
          icon={Trophy}
          label="Questions Answered"
          value={totalQuestions}
          color="violet"
        />
      </div>

      {/* Attempt history */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-3">
          Quiz History
        </h3>
        {!completed || completed.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No quiz attempts yet"
            description="This student hasn't taken any quizzes."
          />
        ) : (
          <div className="space-y-2">
            {completed.map((a, idx) => {
              const pct = Math.round(a.scorePercentage);
              const isGood = pct >= 70;
              const label = a.topic
                ? a.topic.name
                : a.quizSet
                  ? a.quizSet.name
                  : a.subject
                    ? a.subject.name
                    : "Quiz";
              const breadcrumb = a.topic
                ? `${a.topic.subject.class.name} · ${a.topic.subject.name}`
                : a.quizSet
                  ? a.quizSet.class.name
                  : a.subject
                    ? `${a.subject.class.name} · ${a.subject.name} (Subject Exam)`
                    : "";
              return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.15,
                      delay: Math.min(idx * 0.03, 0.3),
                    }}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-4"
                  >
                    <div
                      className={cn(
                        "size-10 rounded-lg flex items-center justify-center shrink-0",
                        isGood
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      <Trophy className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {breadcrumb}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(a.completedAt!).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={cn(
                          "text-lg font-bold",
                          isGood ? "text-emerald-600" : "text-amber-600"
                        )}
                      >
                        {a.correctAnswers}/{a.totalQuestions}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-medium",
                          isGood ? "text-emerald-700" : "text-amber-700"
                        )}
                      >
                        {pct}%
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}
      </div>
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
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: keyof typeof COLOR_MAP;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div
          className={cn(
            "size-9 rounded-lg flex items-center justify-center",
            COLOR_MAP[color]
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}
