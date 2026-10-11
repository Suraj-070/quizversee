"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  PlayCircle,
  Eye,
  EyeOff,
  Layers,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import {
  useQuizSessionStore,
  type FeedbackMode,
} from "@/stores/quiz-session-store";
import { StudentHeader } from "@/components/student/student-header";
import { cn } from "@/lib/utils";

/**
 * SubjectQuizSetup — the screen where the student starts a subject-level
 * exam that pulls questions randomly from ALL topics in the subject.
 *
 * Per the user's request:
 *   - Student can choose the number of questions (10/20/30/40 from settings)
 *   - Questions are randomly selected from all topics — never repeated
 *   - Default feedback mode is "exam" (no reveal during quiz, see results at end)
 *   - Student can still switch to "immediate" if they prefer practice mode
 *
 * This is different from a topic-level quiz:
 *   - Topic quiz: questions from ONE topic
 *   - Subject exam: questions from ALL topics in the subject, mixed randomly
 */
type AllowedCount = { count: number; available: boolean };
type SubjectInfo = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  class: { id: string; name: string };
};

export function SubjectQuizSetup({ user }: { user: PublicUser }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const goBack = useViewStore((s) => s.goBack);
  const startQuiz = useQuizSessionStore((s) => s.start);

  const subjectId =
    view.name === "subject-quiz-setup" ? view.subjectId : "";

  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [publishedCount, setPublishedCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [allowedCounts, setAllowedCounts] = useState<AllowedCount[]>([]);
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("exam");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!subjectId) {
      setView({ name: "student-home" });
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/student/subject-questions?subjectId=${subjectId}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("This subject is no longer available.");
          }
          throw new Error("Failed to load subject info");
        }
        const data = (await res.json()) as {
          subject: SubjectInfo;
          publishedCount: number;
          topicCount: number;
          allowedCounts: AllowedCount[];
          defaultFeedbackMode?: FeedbackMode;
        };
        if (cancelled) return;
        setSubject(data.subject);
        setPublishedCount(data.publishedCount);
        setTopicCount(data.topicCount);
        setAllowedCounts(data.allowedCounts);
        if (data.defaultFeedbackMode) setFeedbackMode(data.defaultFeedbackMode);
        // Pre-select the largest available count
        const available = data.allowedCounts.filter((c) => c.available);
        if (available.length > 0) {
          setSelectedCount(available[Math.min(available.length - 1, 2)].count);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load subject info");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [subjectId, setView]);

  async function handleStart() {
    if (!selectedCount || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/student/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          totalQuestions: selectedCount,
          feedbackMode,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to start exam");
      }
      const data = (await res.json()) as {
        attemptId: string;
        questions: Array<{
          id: string;
          questionText: string;
          optionA: string;
          optionB: string;
          optionC: string;
          optionD: string;
          explanation: string | null;
          userAnswerId: string;
          questionImage: string | null;
          optionAImage: string | null;
          optionBImage: string | null;
          optionCImage: string | null;
          optionDImage: string | null;
        }>;
      };
      startQuiz(data.attemptId, data.questions, feedbackMode);
      setView({ name: "quiz-active", attemptId: data.attemptId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start exam");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-emerald-500" />
            <span className="ml-2 text-sm text-slate-500">Loading subject…</span>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <StudentHeader user={user} />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={goBack}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
            {subject?.class.name} → Subject Exam
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">
            {subject?.name}
          </h1>
          {subject?.description && (
            <p className="mt-2 text-slate-600">{subject.description}</p>
          )}

          {/* Summary card */}
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                <Layers className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {publishedCount} questions across {topicCount}{" "}
                  {topicCount === 1 ? "topic" : "topics"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Questions are randomly selected from ALL topics — no repeats
                  within a single exam.
                </p>
              </div>
            </div>
          </div>

          {publishedCount === 0 ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
              <p className="text-sm font-medium text-amber-800">
                This subject has no published questions yet.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={goBack}>
                <ArrowLeft className="size-4" />
                Back to subjects
              </Button>
            </div>
          ) : (
            <>
              {/* Count picker */}
              <div className="mt-8">
                <h2 className="text-base font-semibold text-slate-900">
                  How many questions would you like?
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Unavailable quantities are disabled.
                </p>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {allowedCounts.map((c) => (
                    <CountTile
                      key={c.count}
                      count={c.count}
                      available={c.available}
                      selected={selectedCount === c.count}
                      onSelect={() => c.available && setSelectedCount(c.count)}
                    />
                  ))}
                </div>
                {publishedCount > 0 && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label htmlFor="custom-question-count" className="block text-sm font-medium text-slate-700">
                      Custom number of questions (1–{publishedCount})
                    </label>
                    <input
                      id="custom-question-count"
                      type="number"
                      min={1}
                      max={publishedCount}
                      step={1}
                      value={selectedCount ?? ""}
                      onChange={(e) => {
                        if (e.target.value === "") { setSelectedCount(null); return; }
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 1 && n <= publishedCount) setSelectedCount(n);
                      }}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">You can start a quiz even with just one question.</p>
                  </div>
                )}
              </div>

              {/* Feedback mode selector */}
              <div className="mt-8">
                <h2 className="text-base font-semibold text-slate-900">
                  Feedback mode
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  When do you want to see if your answer was right?
                </p>

                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <ModeTile
                    mode="immediate"
                    selected={feedbackMode === "immediate"}
                    onSelect={() => setFeedbackMode("immediate")}
                    icon={Eye}
                    title="Immediate feedback"
                    description="See the correct answer + explanation right after each question."
                    badge="Practice"
                  />
                  <ModeTile
                    mode="exam"
                    selected={feedbackMode === "exam"}
                    onSelect={() => setFeedbackMode("exam")}
                    icon={EyeOff}
                    title="Exam mode"
                    description="No reveals during the quiz — see all results at the end, like a real exam."
                    badge="Test yourself"
                  />
                </div>
              </div>

              {/* Start button */}
              <div className="mt-8 flex justify-end">
                <Button
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={!selectedCount || starting}
                  onClick={handleStart}
                >
                  {starting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    <>
                      <PlayCircle className="size-5" />
                      Start Exam ({selectedCount}{" "}
                      {selectedCount === 1 ? "question" : "questions"})
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function CountTile({
  count,
  available,
  selected,
  onSelect,
}: {
  count: number;
  available: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!available}
      className={cn(
        "relative rounded-xl border-2 px-4 py-5 text-center transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
        !available && "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed",
        available && !selected && "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50",
        available && selected && "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
      )}
    >
      <div
        className={cn(
          "text-2xl font-bold",
          available ? "text-slate-900" : "text-slate-400"
        )}
      >
        {count}
      </div>
      <div
        className={cn(
          "text-xs mt-0.5",
          available ? "text-slate-500" : "text-slate-400"
        )}
      >
        {available ? "questions" : "unavailable"}
      </div>
      {!available && (
        <div className="absolute top-2 right-2">
          <Lock className="size-3.5 text-slate-400" />
        </div>
      )}
    </button>
  );
}

function ModeTile({
  mode,
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
  badge,
}: {
  mode: FeedbackMode;
  selected: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative text-left rounded-xl border-2 p-4 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
        !selected &&
          "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30",
        selected && "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "size-10 rounded-lg flex items-center justify-center shrink-0",
            selected
              ? "bg-emerald-500 text-white"
              : "bg-slate-100 text-slate-600"
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded",
                selected
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {badge}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      {selected && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="size-4 text-emerald-500" />
        </div>
      )}
    </button>
  );
}
