"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  GripVertical,
} from "lucide-react";
import type { AcademicClass, AcademicSubject, AcademicTopic } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

type TopicWithParents = AcademicTopic & {
  subject: {
    id: string;
    name: string;
    class: { id: string; name: string };
  };
  _count: { questions: number };
};

/**
 * AdminTopics — full CRUD UI for the Topic entity.
 *
 * Uses DEPENDENT SELECTORS:
 *   - Filter row: Class dropdown → Subjects dropdown (subjects depend on the
 *     selected class).
 *   - Create/Edit form: Parent class → Parent subject (subject depends on
 *     the selected class).
 *
 * This satisfies PRD §9: "When Class 9 is selected, only subjects belonging
 * to Class 9 should appear. When Science is selected, only topics belonging
 * to Science should appear."
 */
export function AdminTopics() {
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [filterSubjects, setFilterSubjects] = useState<AcademicSubject[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<string>("all");
  const [topics, setTopics] = useState<TopicWithParents[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TopicWithParents | null>(null);
  const [creating, setCreating] = useState(false);

  // Load classes once.
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

  // Whenever the filter class changes, refresh the dependent subject list.
  useEffect(() => {
    if (filterClassId === "all") {
      setFilterSubjects([]);
      setFilterSubjectId("all");
      return;
    }
    let cancelled = false;
    async function loadSubjects() {
      try {
        const res = await fetch(
          `/api/admin/subjects?classId=${filterClassId}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { subjects: AcademicSubject[] };
        if (cancelled) return;
        setFilterSubjects(data.subjects);
        setFilterSubjectId("all"); // reset subject filter when class changes
      } catch {
        // ignore
      }
    }
    loadSubjects();
    return () => {
      cancelled = true;
    };
  }, [filterClassId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/topics", window.location.origin);
      if (filterSubjectId !== "all") {
        url.searchParams.set("subjectId", filterSubjectId);
      } else if (filterClassId !== "all") {
        url.searchParams.set("classId", filterClassId);
      }
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load topics");
      const data = (await res.json()) as { topics: TopicWithParents[] };
      setTopics(data.topics);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load topics");
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [filterClassId, filterSubjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (topics ?? []).filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Topics</h2>
          <p className="text-sm text-slate-600 mt-1">
            Topics belong to a subject. Each topic contains questions.
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
            Add Topic
          </Button>
        </div>
      </div>

      {classes.length === 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You need to create at least one class and subject before you can add
          topics.
        </div>
      )}

      {/* Dependent filters: Class → Subject */}
      {topics && topics.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search topics by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm flex-1"
          />
          <Select value={filterClassId} onValueChange={setFilterClassId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by class" />
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
            <SelectTrigger className="w-[200px]">
              <SelectValue
                placeholder={
                  filterClassId === "all"
                    ? "Pick a class first"
                    : "All subjects"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {filterSubjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* List */}
      {loading ? (
        <ListSkeleton rows={5} />
      ) : !topics || topics.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No topics yet"
          description={
            classes.length === 0
              ? "Create a class and subject first, then add topics."
              : "Add your first topic to start collecting questions."
          }
          action={
            classes.length > 0 ? (
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
                Add Topic
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
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Class</th>
                  <th className="px-4 py-3 text-left font-medium">Subject</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                    Questions
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                    Order
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((topic, idx) => (
                  <motion.tr
                    key={topic.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    className="hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {topic.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {topic.subject.class.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {topic.subject.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {topic._count.questions}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={topic.isActive ? "active" : "inactive"}
                        label={topic.isActive ? "Active" : "Disabled"}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <GripVertical className="size-3 text-slate-400" />
                        {topic.displayOrder}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(topic)}
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
                          title="Delete this topic?"
                          entityName={topic.name}
                          fetchCounts={async () => {
                            const res = await fetch(
                              `/api/admin/topics/${topic.id}`
                            );
                            if (!res.ok) return {};
                            const data = await res.json();
                            return data.counts as Record<string, number>;
                          }}
                          countLabels={{
                            questions: "questions",
                          }}
                          onConfirm={async () => {
                            const res = await fetch(
                              `/api/admin/topics/${topic.id}`,
                              { method: "DELETE" }
                            );
                            if (!res.ok) {
                              const d = await res.json().catch(() => ({}));
                              throw new Error(
                                d.error ?? "Failed to delete topic"
                              );
                            }
                            toast.success(`Deleted "${topic.name}"`);
                            await load();
                          }}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500 text-sm"
                    >
                      No topics match &quot;{search}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit dialog with dependent selectors */}
      <TopicDialog
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
// Create/Edit Dialog — with dependent Class → Subject selectors
// ---------------------------------------------------------------------------

function TopicDialog({
  open,
  editing,
  classes,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: TopicWithParents | null;
  classes: AcademicClass[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [classId, setClassId] = useState<string>("");
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When editing, derive the parent class from the topic's subject.
  const initialClassId = editing?.subject.class.id ?? classes[0]?.id ?? "";

  // Reset form whenever the dialog opens with a new editing target.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setClassId(editing.subject.class.id);
      setSubjectId(editing.subjectId);
      setName(editing.name);
      setDescription(editing.description ?? "");
      setIsActive(editing.isActive);
      setDisplayOrder(editing.displayOrder);
    } else {
      setClassId(initialClassId);
      setSubjectId("");
      setName("");
      setDescription("");
      setIsActive(true);
      setDisplayOrder(0);
    }
  }, [open, editing, initialClassId]);

  // Load subjects whenever the parent class changes (dependent dropdown).
  useEffect(() => {
    if (!classId) {
      setSubjects([]);
      return;
    }
    let cancelled = false;
    async function loadSubjectsForClass() {
      try {
        const res = await fetch(`/api/admin/subjects?classId=${classId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { subjects: AcademicSubject[] };
        if (cancelled) return;
        setSubjects(data.subjects);
        // If the current subjectId isn't in this class's subjects, reset it.
        if (
          editing &&
          editing.subject.class.id === classId &&
          data.subjects.some((s) => s.id === editing.subjectId)
        ) {
          setSubjectId(editing.subjectId);
        } else if (!data.subjects.some((s) => s.id === subjectId)) {
          setSubjectId("");
        }
      } catch {
        // ignore
      }
    }
    loadSubjectsForClass();
    return () => {
      cancelled = true;
    };
  }, [classId, open, editing, subjectId]);

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
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/topics/${editing.id}`
        : "/api/admin/topics";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          name: name.trim(),
          description: description.trim() || null,
          isActive,
          displayOrder: Number(displayOrder) || 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save topic");
      }
      toast.success(editing ? "Topic updated" : "Topic created");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save topic");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Topic" : "Create Topic"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this topic's details."
              : "Add a new topic under a subject."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dependent selectors: Class → Subject */}
          <FormField label="Parent class" htmlFor="topic-class" required>
            <Select
              value={classId}
              onValueChange={(v) => {
                setClassId(v);
                setSubjectId("");
              }}
              disabled={saving}
            >
              <SelectTrigger id="topic-class">
                <SelectValue placeholder="Select a class" />
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
            label="Parent subject"
            htmlFor="topic-subject"
            required
            hint={
              !classId
                ? "Pick a class first."
                : subjects.length === 0
                  ? "No subjects in this class yet."
                  : undefined
            }
          >
            <Select
              value={subjectId}
              onValueChange={setSubjectId}
              disabled={saving || !classId || subjects.length === 0}
            >
              <SelectTrigger id="topic-subject">
                <SelectValue placeholder="Select a subject" />
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

          <FormField label="Name" htmlFor="topic-name" required>
            <Input
              id="topic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Force and Motion"
              disabled={saving}
              autoFocus
            />
          </FormField>

          <FormField
            label="Description"
            htmlFor="topic-desc"
            hint="Optional — shown to students."
          >
            <Textarea
              id="topic-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of this topic."
              rows={3}
              disabled={saving}
            />
          </FormField>

          <FormField label="Display order" htmlFor="topic-order">
            <Input
              id="topic-order"
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              disabled={saving}
            />
          </FormField>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
            <div>
              <Label className="text-sm font-medium">Active</Label>
              <p className="text-xs text-slate-500 mt-0.5">
                Disabled topics are hidden from students.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={saving} />
          </div>

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
              {editing ? "Save changes" : "Create topic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
