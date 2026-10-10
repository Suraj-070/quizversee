"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  GripVertical,
} from "lucide-react";
import type { AcademicClass } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

/**
 * AdminClasses — full CRUD UI for the Class entity.
 *
 * Layout:
 *   - Header: title + "Add Class" button
 *   - Optional filter (search by name)
 *   - Table: Name | Status | Order | Actions (Edit / Delete)
 *   - Create/Edit modal: name, description, isActive, displayOrder
 *   - Delete confirmation with affected child counts
 */
export function AdminClasses() {
  const setView = useViewStore((s) => s.setView);

  const [classes, setClasses] = useState<AcademicClass[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AcademicClass | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/classes", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load classes");
      const data = (await res.json()) as { classes: AcademicClass[] };
      setClasses(data.classes);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load classes");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (classes ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Classes</h2>
          <p className="text-sm text-slate-600 mt-1">
            Top-level academic grouping. Each class contains subjects and
            topics.
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
          >
            <Plus className="size-4" />
            Add Class
          </Button>
        </div>
      </div>

      {/* Search */}
      {classes && classes.length > 0 && (
        <Input
          placeholder="Search classes by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      )}

      {/* List */}
      {loading ? (
        <ListSkeleton rows={5} />
      ) : !classes || classes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No classes yet"
          description="Create your first class to start building the academic hierarchy."
          action={
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-4" />
              Add Class
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                    Order
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((klass, idx) => (
                  <motion.tr
                    key={klass.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    className="hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {klass.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell max-w-xs truncate">
                      {klass.description ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        tone={klass.isActive ? "active" : "inactive"}
                        label={klass.isActive ? "Active" : "Disabled"}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <GripVertical className="size-3 text-slate-400" />
                        {klass.displayOrder}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(klass)}
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
                          title="Delete this class?"
                          entityName={klass.name}
                          fetchCounts={async () => {
                            const res = await fetch(
                              `/api/admin/classes/${klass.id}`
                            );
                            if (!res.ok) return {};
                            const data = await res.json();
                            return data.counts as Record<string, number>;
                          }}
                          countLabels={{
                            subjects: "subjects",
                            topics: "topics",
                            questions: "questions",
                          }}
                          onConfirm={async () => {
                            const res = await fetch(
                              `/api/admin/classes/${klass.id}`,
                              { method: "DELETE" }
                            );
                            if (!res.ok) {
                              const d = await res.json().catch(() => ({}));
                              throw new Error(
                                d.error ?? "Failed to delete class"
                              );
                            }
                            toast.success(`Deleted "${klass.name}"`);
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
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500 text-sm"
                    >
                      No classes match &quot;{search}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <ClassDialog
        open={creating || editing !== null}
        editing={editing}
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

function ClassDialog({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: AcademicClass | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever the dialog opens with a new editing target.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setIsActive(editing.isActive);
      setDisplayOrder(editing.displayOrder);
    } else {
      setName("");
      setDescription("");
      setIsActive(true);
      setDisplayOrder(0);
    }
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/classes/${editing.id}`
        : "/api/admin/classes";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isActive,
          displayOrder: Number(displayOrder) || 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save class");
      }
      toast.success(editing ? "Class updated" : "Class created");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save class");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Class" : "Create Class"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this class's details."
              : "Add a new class to the platform."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Name" htmlFor="class-name" required>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Class 9"
              disabled={saving}
              autoFocus
            />
          </FormField>

          <FormField
            label="Description"
            htmlFor="class-desc"
            hint="Optional — shown to students as a subtitle."
          >
            <Textarea
              id="class-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of this class."
              rows={3}
              disabled={saving}
            />
          </FormField>

          <FormField
            label="Display order"
            htmlFor="class-order"
            hint="Lower numbers appear first."
          >
            <Input
              id="class-order"
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
                Disabled classes are hidden from students.
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
              {editing ? "Save changes" : "Create class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
