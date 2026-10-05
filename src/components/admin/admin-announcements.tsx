"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Megaphone, Plus, Pencil, Trash2, RefreshCw, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { toast } from "sonner";

type Announcement = {
  id: string; title: string; message: string; status: string;
  publishDate: string; expiryDate: string | null;
  createdAt: string; admin: { name: string } | null;
};

export function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcements", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { announcements: Announcement[] };
      setItems(data.announcements);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Announcements</h2>
          <p className="text-sm text-slate-600 mt-1">Publish notices visible to students on their dashboard.</p>
        </div>
        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New Announcement
        </Button>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : !items || items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" description="Create your first announcement." />
      ) : (
        <div className="space-y-3">
          {items.map((a, idx) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: Math.min(idx * 0.03, 0.3) }}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{a.title}</h3>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{a.message}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    {new Date(a.publishDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {a.expiryDate && ` · expires ${new Date(a.expiryDate).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <StatusBadge tone={a.status === "published" ? "published" : "draft"} label={a.status === "published" ? "Published" : "Draft"} />
                  <Button variant="ghost" size="sm" onClick={() => setEditing(a)}><Pencil className="size-4" /></Button>
                  <ConfirmDialog
                    trigger={<Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="size-4" /></Button>}
                    title="Archive this announcement?"
                    entityName={a.title}
                    onConfirm={async () => {
                      await fetch(`/api/admin/announcements/${a.id}`, { method: "DELETE" });
                      toast.success("Archived");
                      await load();
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnnouncementDialog open={creating || editing !== null} editing={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={async () => { setCreating(false); setEditing(null); await load(); }} />
    </div>
  );
}

function AnnouncementDialog({ open, editing, onClose, onSaved }: {
  open: boolean; editing: Announcement | null; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title); setMessage(editing.message); setStatus(editing.status);
    } else {
      setTitle(""); setMessage(""); setStatus("draft");
    }
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/admin/announcements/${editing.id}` : "/api/admin/announcements";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, status }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(editing ? "Updated" : "Created");
      await onSaved();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} autoFocus />
          </FormField>
          <FormField label="Message" required>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} disabled={saving} />
          </FormField>
          <FormField label="Status" required>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="ann-status" value="draft" checked={status === "draft"} onChange={() => setStatus("draft")} /> Draft
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="ann-status" value="published" checked={status === "published"} onChange={() => setStatus("published")} /> Published
              </label>
            </div>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
