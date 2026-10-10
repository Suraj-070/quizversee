"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Loader2,
  ListChecks,
} from "lucide-react";
import type { AcademicClass, AcademicSubject, AcademicTopic } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type QuizSetDetail = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "published";
  class: { id: string; name: string };
  subject: { id: string; name: string } | null;
  questions: Array<{
    question: {
      id: string;
      questionText: string;
      status: string;
      topic: {
        id: string;
        name: string;
        subject: {
          id: string;
          name: string;
          class: { id: string; name: string };
        };
      };
    };
  }>;
};

type CandidateQuestion = {
  id: string;
  questionText: string;
  topic: {
    id: string;
    name: string;
    subject: {
      id: string;
      name: string;
      class: { id: string; name: string };
    };
  };
  inSet: boolean;
};

/**
 * AdminQuizSetDetail — manage which questions belong to a quiz set.
 *
 * Two-panel layout:
 *   - Left: questions currently in this set (with remove buttons)
 *   - Right: candidate questions (published, same class) with add buttons
 *
 * Per PRD §12: "Add/remove questions".
 */
export function AdminQuizSetDetail({ quizSetId }: { quizSetId: string }) {
  const [quizSet, setQuizSet] = useState<QuizSetDetail | null>(null);
  const [candidates, setCandidates] = useState<CandidateQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCand, setLoadingCand] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState<string>("all");
  const [topicId, setTopicId] = useState<string>("all");
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [topics, setTopics] = useState<AcademicTopic[]>([]);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const loadQuizSet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/quiz-sets/${quizSetId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load quiz set");
      const data = (await res.json()) as { quizSet: QuizSetDetail };
      setQuizSet(data.quizSet);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load quiz set");
    } finally {
      setLoading(false);
    }
  }, [quizSetId]);

  const loadCandidates = useCallback(async () => {
    if (!quizSet) return;
    setLoadingCand(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (subjectId !== "all") params.set("subjectId", subjectId);
      if (topicId !== "all") params.set("topicId", topicId);
      const res = await fetch(
        `/api/admin/quiz-sets/${quizSetId}/questions?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load questions");
      const data = (await res.json()) as { questions: CandidateQuestion[] };
      setCandidates(data.questions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoadingCand(false);
    }
  }, [quizSet, quizSetId, search, subjectId, topicId]);

  useEffect(() => {
    loadQuizSet();
  }, [loadQuizSet]);

  useEffect(() => {
    if (quizSet) loadCandidates();
  }, [quizSet, loadCandidates]);

  // Load subjects + topics for the candidate filters (scoped to the quiz set's class)
  useEffect(() => {
    if (!quizSet) return;
    let cancelled = false;
    async function loadFilters() {
      try {
        const subjRes = await fetch(
          `/api/admin/subjects?classId=${quizSet!.class.id}`,
          { cache: "no-store" }
        );
        if (subjRes.ok) {
          const subjData = (await subjRes.json()) as {
            subjects: AcademicSubject[];
          };
          if (!cancelled) setSubjects(subjData.subjects);
        }
      } catch {
        // ignore
      }
    }
    loadFilters();
    return () => {
      cancelled = true;
    };
  }, [quizSet]);

  useEffect(() => {
    if (subjectId === "all") {
      setTopics([]);
      setTopicId("all");
      return;
    }
    let cancelled = false;
    async function loadTopicsForSubject() {
      try {
        const res = await fetch(
          `/api/admin/topics?subjectId=${subjectId}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { topics: AcademicTopic[] };
        if (!cancelled) {
          setTopics(data.topics);
          setTopicId("all");
        }
      } catch {
        // ignore
      }
    }
    loadTopicsForSubject();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  async function toggleQuestion(questionId: string, action: "add" | "remove") {
    setToggling((prev) => ({ ...prev, [questionId]: true }));
    try {
      const res = await fetch(`/api/admin/quiz-sets/${quizSetId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to update question assignment");
      }
      // Update both lists optimistically
      if (action === "add") {
        const added = candidates.find((c) => c.id === questionId);
        if (added) {
          setQuizSet((prev) =>
            prev
              ? {
                  ...prev,
                  questions: [
                    ...prev.questions,
                    { question: { ...added, status: "published" } },
                  ],
                }
              : prev
          );
          setCandidates((prev) =>
            prev.map((c) =>
              c.id === questionId ? { ...c, inSet: true } : c
            )
          );
        }
      } else {
        setQuizSet((prev) =>
          prev
            ? {
                ...prev,
                questions: prev.questions.filter(
                  (q) => q.question.id !== questionId
                ),
              }
            : prev
        );
        setCandidates((prev) =>
          prev.map((c) =>
            c.id === questionId ? { ...c, inSet: false } : c
          )
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setToggling((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <ListSkeleton rows={3} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (!quizSet) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Quiz set not found"
        description="This quiz set may have been deleted."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <span>Quiz Sets</span>
          <span>/</span>
          <span className="text-slate-700">{quizSet.name}</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{quizSet.name}</h2>
            {quizSet.description && (
              <p className="text-sm text-slate-600 mt-1">
                {quizSet.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              <span>{quizSet.class.name}</span>
              {quizSet.subject && (
                <>
                  <span>·</span>
                  <span>{quizSet.subject.name}</span>
                </>
                )}
              <span>·</span>
              <StatusBadge
                tone={quizSet.status === "published" ? "published" : "draft"}
                label={quizSet.status === "published" ? "Published" : "Draft"}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: questions in set */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Questions in this set
            </h3>
            <span className="text-xs text-slate-500">
              {quizSet.questions.length}{" "}
              {quizSet.questions.length === 1 ? "question" : "questions"}
            </span>
          </div>
          {quizSet.questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No questions assigned yet. Pick from the list on the right.
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {quizSet.questions.map((link, idx) => (
                <motion.div
                  key={link.question.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 line-clamp-2">
                        {link.question.questionText}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {link.question.topic.subject.class.name} ·{" "}
                        {link.question.topic.subject.name} ·{" "}
                        {link.question.topic.name}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                      disabled={!!toggling[link.question.id]}
                      onClick={() =>
                        toggleQuestion(link.question.id, "remove")
                      }
                    >
                      {toggling[link.question.id] ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right: candidate questions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Add questions (published, same class)
          </h3>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={topicId}
              onValueChange={setTopicId}
              disabled={subjectId === "all"}
            >
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="Topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingCand ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg border border-slate-200 bg-white animate-pulse"
                />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No candidate questions match these filters.
            </div>
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {candidates.map((q, idx) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
                  className={cn(
                    "rounded-lg border p-3 shadow-sm",
                    q.inSet
                      ? "border-emerald-200 bg-emerald-50/50"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 line-clamp-2">
                        {q.questionText}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {q.topic.subject.class.name} ·{" "}
                        {q.topic.subject.name} · {q.topic.name}
                      </p>
                    </div>
                    <Button
                      variant={q.inSet ? "outline" : "default"}
                      size="sm"
                      className={
                        q.inSet
                          ? "shrink-0"
                          : "bg-emerald-500 hover:bg-emerald-600 text-white shrink-0"
                      }
                      disabled={!!toggling[q.id] || q.inSet}
                      onClick={() => toggleQuestion(q.id, "add")}
                    >
                      {toggling[q.id] ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      {q.inSet ? "Added" : "Add"}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
