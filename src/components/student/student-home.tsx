"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, GraduationCap, Loader2, AlertTriangle, ListChecks,
  ChevronRight, Megaphone, Play, TrendingUp, Award, Target,
  Clock, X, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { useQuizSessionStore } from "@/stores/quiz-session-store";
import { StudentHeader } from "@/components/student/student-header";
import { ClassCard, type StudentClass } from "@/components/student/class-card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

type Announcement = {
  id: string; title: string; message: string; publishDate: string;
};

type ProgressStats = {
  quizzesCompleted: number;
  avgScore: number;
  bestScore: number;
};

type RecentlyPracticed = {
  attemptId: string;
  topicName: string;
  subjectName: string;
  score: number;
  total: number;
  percentage: number;
  date: string;
};

type WeakTopic = {
  topicId: string;
  topicName: string;
  subjectName: string;
  className: string;
  correctRate: number;
};

export function StudentHome({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [classes, setClasses] = useState<StudentClass[] | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [progress, setProgress] = useState<ProgressStats | null>(null);
  const [recentlyPracticed, setRecentlyPracticed] = useState<RecentlyPracticed[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());

  // Check if there's an unfinished quiz session
  const sessionAttemptId = useQuizSessionStore((s) => s.attemptId);
  const sessionQuestions = useQuizSessionStore((s) => s.questions);
  const sessionAnswers = useQuizSessionStore((s) => s.answers);
  const [verifiedResumeId, setVerifiedResumeId] = useState<string | null>(null);
  const clearSession = useQuizSessionStore((s) => s.clear);
  useEffect(() => {
    setVerifiedResumeId(null);
    if (!sessionAttemptId) return;
    let cancelled = false;
    async function validateResume() {
      try {
        const res = await fetch(`/api/student/attempts?attemptId=${encodeURIComponent(sessionAttemptId!)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Quiz attempt is unavailable");
        const data = await res.json() as { attempt?: { id: string; completedAt: string | null } };
        if (!cancelled) {
          if (data.attempt?.id === sessionAttemptId && !data.attempt.completedAt) {
            setVerifiedResumeId(sessionAttemptId);
          } else {
            clearSession();
          }
        }
      } catch {
        if (!cancelled) clearSession();
      }
    }
    validateResume();
    return () => { cancelled = true; };
  }, [sessionAttemptId, clearSession]);

  const hasUnfinishedQuiz =
    verifiedResumeId === sessionAttemptId &&
    sessionQuestions.length > 0 &&
    Object.keys(sessionAnswers).length < sessionQuestions.length;
  const answeredCount = Object.keys(sessionAnswers).length;
  const totalQuestions = sessionQuestions.length;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [classesRes, annRes, progressRes, weakRes] = await Promise.all([
          fetch("/api/student/academic", { cache: "no-store" }),
          fetch("/api/student/announcements", { cache: "no-store" }),
          fetch("/api/student/progress", { cache: "no-store" }),
          fetch("/api/student/weak-topics", { cache: "no-store" }),
        ]);

        if (!classesRes.ok) throw new Error("Failed to load classes");
        const classesData = (await classesRes.json()) as { classes: StudentClass[] };
        if (cancelled) return;
        setClasses(classesData.classes);

        if (annRes.ok) {
          const annData = (await annRes.json()) as { announcements: Announcement[] };
          if (!cancelled) setAnnouncements(annData.announcements);
        }

        if (progressRes.ok) {
          const progressData = (await progressRes.json()) as {
            overview: ProgressStats;
            recentlyPracticed: RecentlyPracticed[];
          };
          if (!cancelled) {
            setProgress(progressData.overview);
            setRecentlyPracticed(progressData.recentlyPracticed);
          }
        }

        if (weakRes.ok) {
          const weakData = (await weakRes.json()) as { weakTopics: WeakTopic[] };
          if (!cancelled) setWeakTopics(weakData.weakTopics);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load classes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const activeAnnouncements = announcements.filter(
    (a) => !dismissedAnnouncements.has(a.id)
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={user} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3.5 py-1.5 text-xs font-medium mb-5"
          >
            <Sparkles className="size-3" />
            Welcome, {user.name.split(" ")[0]}
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
            Ready to practice?
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            Pick a class to start. Choose your subject, drill into a topic,
            and we&apos;ll handle the rest.
          </p>
        </motion.div>

        {/* Announcements */}
        {activeAnnouncements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 space-y-2"
          >
            {activeAnnouncements.slice(0, 2).map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3"
              >
                <Megaphone className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-900">{a.title}</p>
                  <p className="text-sm text-emerald-700 mt-0.5">{a.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDismissedAnnouncements((prev) => new Set([...prev, a.id]))
                  }
                  className="shrink-0 text-emerald-400 hover:text-emerald-600"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </motion.div>
        )}

        {/* Continue Learning (resume unfinished quiz) */}
        {hasUnfinishedQuiz && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-8"
          >
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 flex items-center gap-4">
              <div className="size-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Play className="size-6 fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900">Continue Quiz</h3>
                <p className="text-sm text-slate-600 mt-0.5">
                  {answeredCount} of {totalQuestions} answered
                </p>
                <div className="mt-2 h-1.5 rounded-full bg-emerald-200 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                  />
                </div>
              </div>
              <Button
                className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                onClick={() =>
                  setView({ name: "quiz-active", attemptId: sessionAttemptId! })
                }
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {/* Progress Summary */}
        {progress && progress.quizzesCompleted > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8 grid grid-cols-3 gap-3"
          >
            <ProgressCard
              icon={Target}
              label="Quizzes"
              value={progress.quizzesCompleted}
              color="sky"
            />
            <ProgressCard
              icon={TrendingUp}
              label="Avg Score"
              value={`${progress.avgScore}%`}
              color="emerald"
            />
            <ProgressCard
              icon={Award}
              label="Best Score"
              value={`${progress.bestScore}%`}
              color="amber"
            />
          </motion.div>
        )}

        {/* Needs Practice — weak topics from mastery data */}
        {weakTopics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="mb-8"
          >
            <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-500" />
              Needs Practice
            </h2>
            <div className="space-y-2">
              {weakTopics.slice(0, 3).map((t) => (
                <button
                  key={t.topicId}
                  type="button"
                  onClick={() => setView({ name: "quiz-setup", topicId: t.topicId })}
                  className="w-full rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-center gap-3 hover:bg-amber-50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.topicName}</p>
                    <p className="text-xs text-slate-500">{t.subjectName} · {t.className}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-amber-600">{t.correctRate}%</span>
                    <p className="text-xs text-slate-400">correct</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100">
                    Practice
                  </Button>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recently Practiced */}
        {recentlyPracticed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-8"
          >
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Recently Practiced
            </h2>
            <div className="space-y-2">
              {recentlyPracticed.slice(0, 3).map((r) => (
                <button
                  key={r.attemptId}
                  type="button"
                  onClick={() => setView({ name: "quiz-review", attemptId: r.attemptId })}
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-3 hover:shadow-sm transition-shadow text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.topicName}</p>
                    <p className="text-xs text-slate-500">{r.subjectName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "text-sm font-bold",
                      r.percentage >= 70 ? "text-emerald-600" :
                      r.percentage >= 40 ? "text-amber-600" : "text-red-600"
                    )}>
                      {r.score}/{r.total}
                    </span>
                    <p className="text-xs text-slate-400">{r.percentage}%</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Content */}
        {loading ? (
          <ClassesSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </div>
        ) : !classes || classes.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No classes available yet"
            description="Your administrator hasn't published any classes. Check back soon!"
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((klass, idx) => (
                <ClassCard
                  key={klass.id}
                  klass={klass}
                  index={idx}
                  onClick={() =>
                    setView({ name: "student-subjects", classId: klass.id })
                  }
                />
              ))}
            </div>

            {/* Quiz sets link */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="mt-10"
            >
              <button
                type="button"
                onClick={() => setView({ name: "student-quiz-sets" })}
                className="w-full rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white flex items-center justify-center shadow-sm shadow-violet-500/20">
                      <ListChecks className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Browse quiz sets
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Pre-built collections curated by your instructor.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-slate-300" />
                </div>
              </button>
            </motion.div>
          </>
        )}
      </main>

      <footer className="border-t border-slate-200/60 py-6 mt-auto">
        <p className="text-center text-xs text-slate-400">
          Quizverse — practice MCQs the modern way
        </p>
      </footer>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  amber: "bg-amber-100 text-amber-700",
};

function ProgressCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={cn("size-7 rounded-lg flex items-center justify-center", COLOR_MAP[color])}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900 leading-none">{value}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ClassesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-xl bg-slate-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      ))}
      <div className="col-span-full flex items-center justify-center text-xs text-slate-400 gap-2">
        <Loader2 className="size-3 animate-spin" />
        Loading available classes…
      </div>
    </div>
  );
}
