"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileQuestion,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  Search,
  Eye,
  EyeOff,
} from "lucide-react";
import type {
  AcademicClass,
  AcademicSubject,
  AcademicTopic,
  Question,
  QuestionStatus,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { ImageUpload } from "@/components/admin/image-upload";

type QuestionWithChain = Question & {
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

const PAGE_SIZE = 20;

/**
 * AdminQuestions — full CRUD UI for the Question entity.
 *
 * Per PRD §10:
 *   Columns: Question | Class | Subject | Topic | Status | Created | Actions
 *   Filters: Search + Class + Subject + Topic + Status
 *   Actions: Edit, Delete, Publish/Unpublish
 *
 * Per PRD §11, the create/edit form has 3-level dependent selectors:
 *   Class → Subject → Topic
 */
export function AdminQuestions() {
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [topics, setTopics] = useState<AcademicTopic[]>([]);

  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterSubjectId, setFilterSubjectId] = useState<string>("all");
  const [filterTopicId, setFilterTopicId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [questions, setQuestions] = useState<QuestionWithChain[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<QuestionWithChain | null>(null);
  const [creating, setCreating] = useState(false);

  // Load classes once for the class filter dropdown
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/admin/classes", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { classes: AcademicClass[] };
        setClasses(data.classes);
      } catch {
        // ignore
      }
    }
    loadClasses();
  }, []);

  // Load subjects when filter class changes (dependent dropdown)
  useEffect(() => {
    if (filterClassId === "all") {
      setSubjects([]);
      setFilterSubjectId("all");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/subjects?classId=${filterClassId}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { subjects: AcademicSubject[] };
        if (cancelled) return;
        setSubjects(data.subjects);
        setFilterSubjectId("all");
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filterClassId]);

  // Load topics when filter subject changes (dependent dropdown)
  useEffect(() => {
    if (filterSubjectId === "all") {
      setTopics([]);
      setFilterTopicId("all");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/topics?subjectId=${filterSubjectId}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { topics: AcademicTopic[] };
        if (cancelled) return;
        setTopics(data.topics);
        setFilterTopicId("all");
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filterSubjectId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/questions", window.location.origin);
      if (filterClassId !== "all") url.searchParams.set("classId", filterClassId);
      if (filterSubjectId !== "all")
        url.searchParams.set("subjectId", filterSubjectId);
      if (filterTopicId !== "all") url.searchParams.set("topicId", filterTopicId);
      if (filterStatus !== "all") url.searchParams.set("status", filterStatus);
      if (search.trim()) url.searchParams.set("search", search.trim());
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load questions");
      const data = (await res.json()) as { questions: QuestionWithChain[] };
      setQuestions(data.questions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load questions");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [filterClassId, filterSubjectId, filterTopicId, filterStatus, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePublish(q: QuestionWithChain) {
    const next: QuestionStatus = q.status === "published" ? "draft" : "published";
    try {
      const res = await fetch(`/api/admin/questions/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to update status");
      }
      toast.success(
        next === "published" ? "Question published" : "Question moved to draft"
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  const visible = (questions ?? []).slice(0, PAGE_SIZE);
  const hiddenCount = (questions?.length ?? 0) - visible.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Questions</h2>
          <p className="text-sm text-slate-600 mt-1">
            Create, edit, and publish MCQs. Questions are grouped by topic.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => setCreating(true)}
            disabled={classes.length === 0}
          >
            <Plus className="size-4" />
            Add Question
          </Button>
        </div>
      </div>

      {classes.length === 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You need to create at least one class, subject, and topic before you
          can add questions.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search question text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterClassId} onValueChange={setFilterClassId}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterSubjectId}
          onValueChange={setFilterSubjectId}
          disabled={filterClassId === "all"}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All subjects" />
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
          value={filterTopicId}
          onValueChange={setFilterTopicId}
          disabled={filterSubjectId === "all"}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All topics" />
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : !questions || questions.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No questions yet"
          description={
            classes.length === 0
              ? "Create a class, subject, and topic first, then add questions."
              : "Add your first question to start building the quiz bank."
          }
          action={
            classes.length > 0 ? (
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
                Add Question
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Question</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">
                    Class
                  </th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                    Topic
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((q, idx) => (
                  <motion.tr
                    key={q.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
                    className="hover:bg-slate-50/60 align-top"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 max-w-md">
                      <div className="line-clamp-2">{q.questionText}</div>
                      <div className="mt-1 sm:hidden text-xs text-slate-500">
                        {q.topic.subject.class.name} → {q.topic.subject.name} →{" "}
                        {q.topic.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                      {q.topic.subject.class.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                      {q.topic.subject.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                      {q.topic.name}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={q.status === "published" ? "published" : "draft"}
                        label={q.status === "published" ? "Published" : "Draft"}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
                      {new Date(q.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePublish(q)}
                          title={
                            q.status === "published" ? "Unpublish" : "Publish"
                          }
                          className={
                            q.status === "published"
                              ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          }
                        >
                          {q.status === "published" ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                          <span className="hidden sm:inline">
                            {q.status === "published" ? "Unpublish" : "Publish"}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(q)}
                        >
                          <Pencil className="size-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="size-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </Button>
                          }
                          title="Delete this question?"
                          entityName={q.questionText.slice(0, 80) + (q.questionText.length > 80 ? "…" : "")}
                          onConfirm={async () => {
                            const res = await fetch(
                              `/api/admin/questions/${q.id}`,
                              { method: "DELETE" }
                            );
                            if (!res.ok) {
                              const d = await res.json().catch(() => ({}));
                              throw new Error(
                                d.error ?? "Failed to delete question"
                              );
                            }
                            toast.success("Question deleted");
                            await load();
                          }}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {hiddenCount > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
              Showing {visible.length} of {questions.length} questions. Narrow
              your filters to see more.
            </div>
          )}
        </div>
      )}

      {/* Create / Edit dialog */}
      <QuestionDialog
        open={creating || editing !== null}
        editing={editing}
        classes={classes}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={async () => {
          setCreating(false);
          setEditing(null);
          await load();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create/Edit Dialog — with 3-level dependent selectors Class → Subject → Topic
// ---------------------------------------------------------------------------

function QuestionDialog({
  open,
  editing,
  classes,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: QuestionWithChain | null;
  classes: AcademicClass[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [classId, setClassId] = useState<string>("");
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [topics, setTopics] = useState<AcademicTopic[]>([]);
  const [topicId, setTopicId] = useState<string>("");

  const [questionText, setQuestionText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [optionAImage, setOptionAImage] = useState<string | null>(null);
  const [optionBImage, setOptionBImage] = useState<string | null>(null);
  const [optionCImage, setOptionCImage] = useState<string | null>(null);
  const [optionDImage, setOptionDImage] = useState<string | null>(null);
  const [correctOption, setCorrectOption] = useState<"A" | "B" | "C" | "D">("A");
  const [explanation, setExplanation] = useState("");
  const [status, setStatus] = useState<QuestionStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with a new target.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      // Pre-populate parent chain from editing target
      setClassId(editing.topic.subject.class.id);
      setSubjectId(editing.topic.subject.id);
      setTopicId(editing.topic.id);
      setQuestionText(editing.questionText);
      setOptionA(editing.optionA);
      setOptionB(editing.optionB);
      setOptionC(editing.optionC);
      setOptionD(editing.optionD);
      setCorrectOption(editing.correctOption);
      setExplanation(editing.explanation ?? "");
      setStatus(editing.status);
      setQuestionImage(editing.questionImage ?? null);
      setOptionAImage(editing.optionAImage ?? null);
      setOptionBImage(editing.optionBImage ?? null);
      setOptionCImage(editing.optionCImage ?? null);
      setOptionDImage(editing.optionDImage ?? null);
    } else {
      setClassId(classes[0]?.id ?? "");
      setSubjectId("");
      setTopicId("");
      setQuestionText("");
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
      setCorrectOption("A");
      setExplanation("");
      setStatus("draft");
      setQuestionImage(null);
      setOptionAImage(null);
      setOptionBImage(null);
      setOptionCImage(null);
      setOptionDImage(null);
    }
  }, [open, editing, classes]);

  // Load subjects when classId changes
  useEffect(() => {
    if (!open || !classId) {
      setSubjects([]);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/subjects?classId=${classId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { subjects: AcademicSubject[] };
        if (cancelled) return;
        setSubjects(data.subjects);
        // If editing and the current subjectId belongs to this class, keep it.
        if (
          editing &&
          editing.topic.subject.class.id === classId &&
          data.subjects.some((s) => s.id === editing.topic.subject.id)
        ) {
          setSubjectId(editing.topic.subject.id);
        } else if (!data.subjects.some((s) => s.id === subjectId)) {
          setSubjectId("");
        }
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [classId, open, editing, subjectId]);

  // Load topics when subjectId changes
  useEffect(() => {
    if (!open || !subjectId) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/topics?subjectId=${subjectId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { topics: AcademicTopic[] };
        if (cancelled) return;
        setTopics(data.topics);
        if (
          editing &&
          editing.topic.subject.id === subjectId &&
          data.topics.some((t) => t.id === editing.topic.id)
        ) {
          setTopicId(editing.topic.id);
        } else if (!data.topics.some((t) => t.id === topicId)) {
          setTopicId("");
        }
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [subjectId, open, editing, topicId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!classId) {
      setError("Please select a parent class");
      return;
    }
    if (!subjectId) {
      setError("Please select a parent subject");
      return;
    }
    if (!topicId) {
      setError("Please select a parent topic");
      return;
    }
    if (!questionText.trim()) {
      setError("Question text is required");
      return;
    }
    if (!optionA.trim() || !optionB.trim() || !optionC.trim() || !optionD.trim()) {
      setError("All four options are required");
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/questions/${editing.id}`
        : "/api/admin/questions";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          questionText: questionText.trim(),
          optionA: optionA.trim(),
          optionB: optionB.trim(),
          optionC: optionC.trim(),
          optionD: optionD.trim(),
          correctOption,
          explanation: explanation.trim() || null,
          status,
          questionImage,
          optionAImage,
          optionBImage,
          optionCImage,
          optionDImage,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save question");
      }
      toast.success(editing ? "Question updated" : "Question created");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Question" : "Create Question"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this question's content or status."
              : "Add a new MCQ. Pick the parent class → subject → topic first."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 3-level dependent selectors */}
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Class" required>
              <Select
                value={classId}
                onValueChange={(v) => {
                  setClassId(v);
                  setSubjectId("");
                  setTopicId("");
                }}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Subject"
              required
              hint={
                !classId
                  ? "Pick class first."
                  : subjects.length === 0
                    ? "No subjects."
                    : undefined
              }
            >
              <Select
                value={subjectId}
                onValueChange={(v) => {
                  setSubjectId(v);
                  setTopicId("");
                }}
                disabled={saving || !classId || subjects.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Topic"
              required
              hint={
                !subjectId
                  ? "Pick subject first."
                  : topics.length === 0
                    ? "No topics."
                    : undefined
              }
            >
              <Select
                value={topicId}
                onValueChange={setTopicId}
                disabled={saving || !subjectId || topics.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="Question" htmlFor="q-text" required>
            <Textarea
              id="q-text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="e.g. What is the SI unit of force?"
              rows={3}
              disabled={saving}
            />
          </FormField>

          {/* Optional question image (e.g. a diagram, graph, or figure) */}
          <ImageUpload
            value={questionImage}
            onChange={setQuestionImage}
            label="Question image (optional — diagram, graph, figure)"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <OptionField
              label="Option A"
              value={optionA}
              onChange={setOptionA}
              selected={correctOption === "A"}
              onSelect={() => setCorrectOption("A")}
              disabled={saving}
              image={optionAImage}
              onImageChange={setOptionAImage}
            />
            <OptionField
              label="Option B"
              value={optionB}
              onChange={setOptionB}
              selected={correctOption === "B"}
              onSelect={() => setCorrectOption("B")}
              disabled={saving}
              image={optionBImage}
              onImageChange={setOptionBImage}
            />
            <OptionField
              label="Option C"
              value={optionC}
              onChange={setOptionC}
              selected={correctOption === "C"}
              onSelect={() => setCorrectOption("C")}
              disabled={saving}
              image={optionCImage}
              onImageChange={setOptionCImage}
            />
            <OptionField
              label="Option D"
              value={optionD}
              onChange={setOptionD}
              selected={correctOption === "D"}
              onSelect={() => setCorrectOption("D")}
              disabled={saving}
              image={optionDImage}
              onImageChange={setOptionDImage}
            />
          </div>

          <FormField
            label="Explanation"
            htmlFor="q-explanation"
            hint="Optional — shown to students after they answer."
          >
            <Textarea
              id="q-explanation"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="e.g. Force is measured in newtons (N). 1 N = 1 kg·m/s²."
              rows={2}
              disabled={saving}
            />
          </FormField>

          <FormField label="Status" required>
            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as QuestionStatus)}
              className="flex gap-4"
              disabled={saving}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="draft" id="status-draft" />
                <Label htmlFor="status-draft" className="text-sm">
                  Draft (hidden from students)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="published" id="status-published" />
                <Label htmlFor="status-published" className="text-sm">
                  Published (visible to students)
                </Label>
              </div>
            </RadioGroup>
          </FormField>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OptionField({
  label,
  value,
  onChange,
  selected,
  onSelect,
  disabled,
  image,
  onImageChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  image: string | null;
  onImageChange: (v: string | null) => void;
}) {
  return (
    <div
      className={
        "rounded-lg border px-3 py-2 transition-colors " +
        (selected
          ? "border-emerald-400 bg-emerald-50"
          : "border-slate-200 bg-white")
      }
    >
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          className={
            "size-5 rounded-full border-2 flex items-center justify-center transition-colors " +
            (selected
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300 hover:border-emerald-400")
          }
          aria-label={`Mark ${label} as correct`}
        >
          {selected && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-3"
            >
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
        <label className="text-xs font-medium text-slate-600">{label}</label>
        {selected && (
          <span className="ml-auto text-xs text-emerald-600 font-medium">
            Correct
          </span>
        )}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Option ${label.split(" ")[1]} text`}
        disabled={disabled}
        className="border-0 px-0 focus-visible:ring-0 focus-visible:border-0 h-8"
      />
      <ImageUpload value={image} onChange={onImageChange} className="mt-2" />
    </div>
  );
}
