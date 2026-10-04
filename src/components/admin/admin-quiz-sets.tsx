"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import type { AcademicClass } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useViewStore } from "@/stores/view-store";

type QuizSetRow = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "published";
  createdAt: string;
  class: { id: string; name: string };
  subject: { id: string; name: string } | null;
  _count: { questions: number };
};

/**
 * AdminQuizSets — list view for quiz sets.
 *
 * Per PRD §12:
 *   Admin can create quiz set → give it a name → select class → select
 *   subject → select topic(s) → add/remove questions → publish/unpublish.
 *
 * Clicking a row navigates to the detail view (admin-quiz-set-detail)
 * where questions can be assigned/unassigned.
 */
export function AdminQuizSets() {
  const setView = useViewStore((s) => s.setView);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [quizSets, setQuizSets] = useState<QuizSetRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<QuizSetRow | null>(null);
  const [creating, setCreating] = useState(false);

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/quiz-sets", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load quiz sets");
      const data = (await res.json()) as { quizSets: QuizSetRow[] };
      setQuizSets(data.quizSets);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load quiz sets");
      setQuizSets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (quizSets ?? []).filter((qs) =>
    qs.name.toLowerCase().includes(search.toLowerCase())
  );

  async function togglePublish(qs: QuizSetRow) {
    const next = qs.status === "published" ? "draft" : "published";
    try {
      const res = await fetch(`/api/admin/quiz-sets/${qs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to update status");
      }
      toast.success(
        next === "published" ? "Quiz set published" : "Quiz set moved to draft"
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quiz Sets</h2>
          <p className="text-sm text-slate-600 mt-1">
            Group questions into named practice sets. Students can take a set
            instead of a topic.
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
            Add Quiz Set
          </Button>
        </div>
      </div>

      {classes.length === 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You need to create at least one class before you can add quiz sets.
        </div>
      )}

      {quizSets && quizSets.length > 0 && (
        <Input
          placeholder="Search quiz sets by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : !quizSets || quizSets.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No quiz sets yet"
          description={
            classes.length === 0
              ? "Create a class first, then add quiz sets."
              : "Quiz sets let you group specific questions for targeted practice."
          }
          action={
            classes.length > 0 ? (
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
                Add Quiz Set
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
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Questions</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((qs, idx) => (
                  <motion.tr
                    key={qs.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
                    className="hover:bg-slate-50/60 cursor-pointer"
                    onClick={() =>
                      setView({
                        name: "admin-quiz-set-detail",
                        quizSetId: qs.id,
                      })
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div className="line-clamp-1">{qs.name}</div>
                      {qs.description && (
                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {qs.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{qs.class.name}</td>
                    <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                      {qs.subject?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {qs._count.questions}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={qs.status === "published" ? "published" : "draft"}
                        label={qs.status === "published" ? "Published" : "Draft"}
                      />
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePublish(qs)}
                          title={
                            qs.status === "published" ? "Unpublish" : "Publish"
                          }
                          className={
                            qs.status === "published"
                              ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          }
                        >
                          {qs.status === "published" ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(qs)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          }
                          title="Delete this quiz set?"
                          entityName={qs.name}
                          onConfirm={async () => {
                            const res = await fetch(
                              `/api/admin/quiz-sets/${qs.id}`,
                              { method: "DELETE" }
                            );
                            if (!res.ok) {
                              const d = await res.json().catch(() => ({}));
                              throw new Error(
                                d.error ?? "Failed to delete quiz set"
                              );
                            }
                            toast.success(`Deleted "${qs.name}"`);
                            await load();
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setView({
                              name: "admin-quiz-set-detail",
                              quizSetId: qs.id,
                            })
                          }
                          title="Manage questions"
                        >
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <QuizSetDialog
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
// Create/Edit Dialog
// ---------------------------------------------------------------------------

function QuizSetDialog({
  open,
  editing,
  classes,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: QuizSetRow | null;
  classes: AcademicClass[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [classId, setClassId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setClassId(editing.class.id);
      setName(editing.name);
      setDescription(editing.description ?? "");
      setStatus(editing.status);
    } else {
      setClassId(classes[0]?.id ?? "");
      setName("");
      setDescription("");
      setStatus("draft");
    }
  }, [open, editing, classes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!classId) {
      setError("Please select a parent class");
      return;
    }
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/quiz-sets/${editing.id}`
        : "/api/admin/quiz-sets";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          classId,
          description: description.trim() || null,
          status,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save quiz set");
      }
      toast.success(editing ? "Quiz set updated" : "Quiz set created");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save quiz set");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Quiz Set" : "Create Quiz Set"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this quiz set's details."
              : "Add a new quiz set. You can assign questions to it after creation."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Name" htmlFor="qs-name" required>
            <Input
              id="qs-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Force & Motion Practice Set"
              disabled={saving}
              autoFocus
            />
          </FormField>

          <FormField label="Parent class" htmlFor="qs-class" required>
            <Select value={classId} onValueChange={setClassId} disabled={saving}>
              <SelectTrigger id="qs-class">
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

          <FormField label="Description" htmlFor="qs-desc" hint="Optional.">
            <Textarea
              id="qs-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of this quiz set."
              rows={3}
              disabled={saving}
            />
          </FormField>

          <FormField label="Status" required>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="qs-status"
                  value="draft"
                  checked={status === "draft"}
                  onChange={() => setStatus("draft")}
                  disabled={saving}
                />
                Draft
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="qs-status"
                  value="published"
                  checked={status === "published"}
                  onChange={() => setStatus("published")}
                  disabled={saving}
                />
                Published
              </label>
            </div>
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
              {editing ? "Save changes" : "Create quiz set"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
