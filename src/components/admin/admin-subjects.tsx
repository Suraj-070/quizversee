"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  GripVertical,
} from "lucide-react";
import type { AcademicClass, AcademicSubject } from "@/types";
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

type SubjectWithClass = AcademicSubject & {
  class: { id: string; name: string };
  _count: { topics: number };
};

/**
 * AdminSubjects — full CRUD UI for the Subject entity.
 *
 * Layout:
 *   - Header: title + "Add Subject" button
 *   - Filters: search by name + class dropdown
 *   - Table: Name | Class | Topics | Status | Actions
 *   - Create/Edit modal: parent class selector + name, description, icon,
 *     isActive, displayOrder
 */
export function AdminSubjects() {
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithClass[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [editing, setEditing] = useState<SubjectWithClass | null>(null);
  const [creating, setCreating] = useState(false);

  // Load classes once so we can populate the parent-class dropdown.
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/admin/classes", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { classes: AcademicClass[] };
        setClasses(data.classes);
      } catch {
        // ignore — class dropdown will be empty
      }
    }
    loadClasses();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/subjects", window.location.origin);
      if (classFilter !== "all") url.searchParams.set("classId", classFilter);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load subjects");
      const data = (await res.json()) as { subjects: SubjectWithClass[] };
      setSubjects(data.subjects);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load subjects");
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [classFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (subjects ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Subjects</h2>
          <p className="text-sm text-slate-600 mt-1">
            Subjects belong to a class. Each subject contains topics.
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
            Add Subject
          </Button>
        </div>
      </div>

      {classes.length === 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          You need to create at least one class before you can add subjects.
        </div>
      )}

      {/* Filters */}
      {subjects && subjects.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search subjects by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm flex-1"
          />
          <Select value={classFilter} onValueChange={setClassFilter}>
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
        </div>
      )}

      {/* List */}
      {loading ? (
        <ListSkeleton rows={5} />
      ) : !subjects || subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description={
            classes.length === 0
              ? "Create a class first, then add subjects under it."
              : "Add your first subject to start building the topic hierarchy."
          }
          action={
            classes.length > 0 ? (
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
                Add Subject
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
                    Topics
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                    Order
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((subject, idx) => (
                  <motion.tr
                    key={subject.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    className="hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {subject.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {subject.class.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {subject._count.topics}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={subject.isActive ? "active" : "inactive"}
                        label={subject.isActive ? "Active" : "Disabled"}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <GripVertical className="size-3 text-slate-400" />
                        {subject.displayOrder}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(subject)}
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
                          title="Delete this subject?"
                          entityName={subject.name}
                          fetchCounts={async () => {
                            const res = await fetch(
                              `/api/admin/subjects/${subject.id}`
                            );
                            if (!res.ok) return {};
                            const data = await res.json();
                            return data.counts as Record<string, number>;
                          }}
                          countLabels={{
                            topics: "topics",
                            questions: "questions",
                          }}
                          onConfirm={async () => {
                            const res = await fetch(
                              `/api/admin/subjects/${subject.id}`,
                              { method: "DELETE" }
                            );
                            if (!res.ok) {
                              const d = await res.json().catch(() => ({}));
                              throw new Error(
                                d.error ?? "Failed to delete subject"
                              );
                            }
                            toast.success(`Deleted "${subject.name}"`);
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
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500 text-sm"
                    >
                      No subjects match &quot;{search}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <SubjectDialog
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

function SubjectDialog({
  open,
  editing,
  classes,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: SubjectWithClass | null;
  classes: AcademicClass[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [classId, setClassId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setClassId(editing.classId);
      setName(editing.name);
      setDescription(editing.description ?? "");
      setIcon(editing.icon ?? "");
      setIsActive(editing.isActive);
      setDisplayOrder(editing.displayOrder);
    } else {
      setClassId(classes[0]?.id ?? "");
      setName("");
      setDescription("");
      setIcon("");
      setIsActive(true);
      setDisplayOrder(0);
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
        ? `/api/admin/subjects/${editing.id}`
        : "/api/admin/subjects";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          name: name.trim(),
          description: description.trim() || null,
          icon: icon.trim() || null,
          isActive,
          displayOrder: Number(displayOrder) || 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save subject");
      }
      toast.success(editing ? "Subject updated" : "Subject created");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save subject");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Subject" : "Create Subject"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this subject's details."
              : "Add a new subject under a class."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Parent class" htmlFor="subject-class" required>
            <Select value={classId} onValueChange={setClassId} disabled={saving}>
              <SelectTrigger id="subject-class">
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

          <FormField label="Name" htmlFor="subject-name" required>
            <Input
              id="subject-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Science"
              disabled={saving}
              autoFocus
            />
          </FormField>

          <FormField
            label="Description"
            htmlFor="subject-desc"
            hint="Optional — shown to students."
          >
            <Textarea
              id="subject-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of this subject."
              rows={3}
              disabled={saving}
            />
          </FormField>

          <FormField
            label="Icon"
            htmlFor="subject-icon"
            hint="Optional — a lucide icon name, e.g. 'flask-conical'."
          >
            <Input
              id="subject-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="flask-conical"
              disabled={saving}
            />
          </FormField>

          <FormField label="Display order" htmlFor="subject-order">
            <Input
              id="subject-order"
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
                Disabled subjects are hidden from students.
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
              {editing ? "Save changes" : "Create subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
