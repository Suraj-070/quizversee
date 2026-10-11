"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  RefreshCw,
  Loader2,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
  Layers,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/status-badge";
import { toast } from "sonner";
import { useRef } from "react";

type Preview = {
  filename: string;
  className: string;
  subjectName: string;
  topicName: string;
  questionCount: number;
  imagesCount: number;
  validation: { valid: number; warnings: number; errors: number };
  rawJson: string;
};

type HistoryItem = {
  id: string;
  filename: string;
  className: string;
  subjectName: string;
  topicName: string;
  imported: number;
  failed: number;
  skipped: number;
  imagesCount: number;
  createdAt: string;
  admin: { name: string } | null;
};

type ImportResult = {
  success: boolean;
  imported: number;
  failed: number;
  skipped: number;
  imagesCount: number;
  failures: Array<{ index: number; reason: string }>;
  topicName: string;
  importBatchId?: string;
  status?: "draft" | "published";
};

type Batch = {
  batchId: string;
  sourceName: string | null;
  sourceType: string | null;
  total: number;
  drafts: number;
  published: number;
  invalid: number;
  firstImportedAt: string;
  lastImportedAt: string;
};

type BatchQuestion = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  status: string;
  sourceType: string | null;
  sourceName: string | null;
  sourceQuestionId: string | null;
  importBatchId: string | null;
  createdAt: string;
  isInvalid: boolean;
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

type BulkPublishResult = {
  selected: number;
  published: number;
  unpublished: number;
  alreadyTarget: number;
  notFound: number;
  needsReview: number;
  failed: number;
  failures: Array<{ questionId: string; reason: string }>;
};

export function AdminImports() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [importAsDraft, setImportAsDraft] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Batch list state
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchFilter, setBatchFilter] = useState<"all" | "json" | "dataset">("all");

  // Batch detail dialog (View Invalid / View Duplicates / View All)
  const [batchDetail, setBatchDetail] = useState<{
    batchId: string;
    filter: "all" | "invalid" | "duplicates";
  } | null>(null);
  const [batchDetailQuestions, setBatchDetailQuestions] = useState<BatchQuestion[] | null>(null);
  const [batchDetailTotal, setBatchDetailTotal] = useState(0);
  const [batchDetailLoading, setBatchDetailLoading] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());

  // Bulk-publish-from-batch confirmation dialog
  const [batchBulkTarget, setBatchBulkTarget] = useState<{
    batchId: string;
    target: "published" | "draft";
    scope: "all" | "selected";
  } | null>(null);
  const [batchBulkSubmitting, setBatchBulkSubmitting] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/imports/confirm", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load history");
      const data = (await res.json()) as { history: HistoryItem[] };
      setHistory(data.history);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const url = `/api/admin/imports/batches?sourceFilter=${batchFilter}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load batches");
      const data = (await res.json()) as { batches: Batch[]; total: number };
      setBatches(data.batches);
    } catch {
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  }, [batchFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setPreview(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/imports/preview", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Preview failed");
      }
      const data = (await res.json()) as { preview: Preview };
      setPreview(data.preview);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleConfirm() {
    if (!preview || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/admin/imports/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawJson: preview.rawJson,
          filename: preview.filename,
          importAsDraft,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Import failed");
      }
      const data = (await res.json()) as ImportResult;
      setResult(data);
      setPreview(null);
      const verb = data.status === "draft" ? "imported as draft" : "imported";
      toast.success(`${data.imported} questions ${verb} to ${data.topicName}`);
      await Promise.all([loadHistory(), loadBatches()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setConfirming(false);
    }
  }

  // ── Batch detail (View Invalid / View Duplicates) ──────────────────────
  async function openBatchDetail(batchId: string, filter: "all" | "invalid" | "duplicates") {
    setBatchDetail({ batchId, filter });
    setBatchSelectedIds(new Set());
    setBatchDetailQuestions(null);
    setBatchDetailLoading(true);
    try {
      const url = `/api/admin/imports/batches/${encodeURIComponent(batchId)}/questions?filter=${filter}&pageSize=100`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load batch questions");
      const data = (await res.json()) as {
        questions: BatchQuestion[];
        total: number;
      };
      setBatchDetailQuestions(data.questions);
      setBatchDetailTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load batch");
    } finally {
      setBatchDetailLoading(false);
    }
  }

  function toggleBatchQuestionSelection(id: string) {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Bulk publish from batch — TASK D ───────────────────────────────────
  async function executeBatchBulk() {
    if (!batchBulkTarget) return;
    const { batchId, target, scope } = batchBulkTarget;
    setBatchBulkSubmitting(true);
    try {
      let res: Response;
      if (scope === "all") {
        // Use the batch-level bulk-publish endpoint (handles all questions
        // in the batch via server-side filter).
        res = await fetch("/api/admin/imports/batches/bulk-publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId,
            targetStatus: target,
            onlyValid: true,
          }),
        });
      } else {
        // Selected IDs — use the generic bulk-publish endpoint.
        res = await fetch("/api/admin/questions/bulk-publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionIds: Array.from(batchSelectedIds),
            targetStatus: target,
          }),
        });
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Bulk publish failed");
      }
      const data = (await res.json()) as { result: BulkPublishResult };
      const r = data.result;
      const verb = target === "published" ? "published" : "moved to draft";
      const changed = target === "published" ? r.published : r.unpublished;
      toast.success(
        `${changed} question(s) ${verb}. ` +
          (r.alreadyTarget > 0 ? `${r.alreadyTarget} already in target status. ` : "") +
          (r.needsReview > 0 ? `${r.needsReview} need review (invalid). ` : "") +
          (r.failed > 0 ? `${r.failed} failed. ` : "")
      );

      // Refresh batches list + close any open detail dialog
      await loadBatches();
      if (batchDetail) {
        // Re-load the detail to reflect new statuses
        await openBatchDetail(batchDetail.batchId, batchDetail.filter);
      }
      setBatchBulkTarget(null);
      setBatchSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk publish failed");
    } finally {
      setBatchBulkSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Import Center</h2>
        <p className="text-sm text-slate-600 mt-1">
          Upload a JSON question bank file. Preview and validate before importing.
        </p>
      </div>

      {/* Upload area */}
      {!preview && !result && (
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-wait"
          >
          {uploading ? (
            <Loader2 className="size-8 mx-auto animate-spin text-emerald-500" />
          ) : (
            <Upload className="size-8 mx-auto text-slate-400" />
          )}
          <p className="mt-3 text-sm font-medium text-slate-700">
            {uploading ? "Validating…" : "Click to upload a JSON file"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Must have: class, subject, topic, questions[] with options A-D + answer
          </p>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        >
          <div className="flex items-center gap-3 mb-4">
            <FileJson className="size-6 text-emerald-500" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">{preview.filename}</h3>
              <p className="text-xs text-slate-500">
                {preview.className} → {preview.subjectName} → {preview.topicName}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatBox label="Questions" value={preview.questionCount} />
            <StatBox label="Images" value={preview.imagesCount} />
            <StatBox
              label="Valid"
              value={preview.validation.valid}
              icon={<CheckCircle2 className="size-4 text-emerald-500" />}
            />
            <StatBox
              label="Errors"
              value={preview.validation.errors}
              icon={
                preview.validation.errors > 0 ? (
                  <XCircle className="size-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                )
              }
            />
          </div>

          {preview.validation.warnings > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 flex items-center gap-2 mb-4">
              <AlertTriangle className="size-4 shrink-0" />
              {preview.validation.warnings} question(s) have warnings (e.g. missing explanation).
              They will still be imported.
            </div>
          )}

          {preview.validation.errors > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2 mb-4">
              <XCircle className="size-4 shrink-0" />
              {preview.validation.errors} question(s) have errors and will be skipped during import.
            </div>
          )}

          {/* Import-as-draft toggle — TASK D */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={importAsDraft}
                onCheckedChange={(v) => setImportAsDraft(Boolean(v))}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-slate-800">
                  Import as draft (recommended)
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Draft questions stay unpublished until you review and publish them.
                  Unchecking this option publishes valid questions immediately.
                </p>
              </div>
            </label>
          </div>

          {!importAsDraft && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
              Immediate publishing is enabled. Valid questions will be visible to students after import.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={confirming || preview.validation.valid === 0}
              onClick={handleConfirm}
            >
              {confirming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}
              {importAsDraft
                ? `Import ${preview.validation.valid} as Draft`
                : `Import ${preview.validation.valid} Questions`}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card text-center"
        >
          <div className="size-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Import Complete</h3>
          <p className="text-sm text-slate-600 mt-1">
            {result.imported} questions imported to {result.topicName}
            {result.status === "draft" ? " (as draft)" : ""}
          </p>
          {result.importBatchId && (
            <p className="text-xs text-slate-500 mt-1">
              Batch ID: <code className="font-mono">{result.importBatchId}</code>
            </p>
          )}
          {result.failed > 0 && (
            <p className="text-sm text-red-600 mt-1">{result.failed} failed</p>
          )}
          {result.imagesCount > 0 && (
            <p className="text-xs text-slate-500 mt-1">{result.imagesCount} image(s) processed</p>
          )}

          {result.failures.length > 0 && (
            <div className="mt-4 text-left rounded-lg bg-red-50 border border-red-200 p-3 max-h-40 overflow-y-auto">
              {result.failures.map((f, i) => (
                <p key={i} className="text-xs text-red-700">
                  Q{f.index}: {f.reason}
                </p>
              ))}
            </div>
          )}

          <Button
            className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => setResult(null)}
          >
            Import another file
          </Button>
        </motion.div>
      )}

      {/* ── Import Batches — TASK D ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="size-4 text-emerald-500" />
              Import Batches
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and bulk-publish drafts from past imports. Invalid
              questions are never published automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={batchFilter}
              onValueChange={(v) => setBatchFilter(v as "all" | "json" | "dataset")}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="json">JSON imports</SelectItem>
                <SelectItem value="dataset">External datasets</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadBatches}
              disabled={loadingBatches}
            >
              <RefreshCw className={loadingBatches ? "size-4 animate-spin" : "size-4"} />
            </Button>
          </div>
        </div>

        {loadingBatches ? (
          <ListSkeleton rows={3} />
        ) : !batches || batches.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No import batches yet"
            description="Imported questions grouped by batch will appear here, ready for review and bulk publishing."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Batch</th>
                    <th className="px-4 py-3 text-left font-medium">Source</th>
                    <th className="px-4 py-3 text-center font-medium">Total</th>
                    <th className="px-4 py-3 text-center font-medium">Drafts</th>
                    <th className="px-4 py-3 text-center font-medium">Published</th>
                    <th className="px-4 py-3 text-center font-medium">Invalid</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Last imported</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map((b) => (
                    <tr key={b.batchId} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 truncate max-w-[180px]">
                        {b.batchId}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {b.sourceName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700 font-medium">
                        {b.total}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={b.drafts > 0 ? "text-amber-600 font-medium" : "text-slate-400"}>
                          {b.drafts}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={b.published > 0 ? "text-emerald-600 font-medium" : "text-slate-400"}>
                          {b.published}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={b.invalid > 0 ? "text-red-600 font-medium" : "text-slate-400"}>
                          {b.invalid}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">
                        {new Date(b.lastImportedAt).toLocaleString(undefined, {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {b.invalid > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => openBatchDetail(b.batchId, "invalid")}
                              title="View invalid questions"
                            >
                              <AlertTriangle className="size-4" />
                              <span className="hidden md:inline">Invalid</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openBatchDetail(b.batchId, "all")}
                            title="View all questions in this batch"
                          >
                            <Eye className="size-4" />
                            <span className="hidden md:inline">View</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            disabled={b.drafts === 0}
                            onClick={() =>
                              setBatchBulkTarget({
                                batchId: b.batchId,
                                target: "published",
                                scope: "all",
                              })
                            }
                            title="Publish all valid drafts in this batch"
                          >
                            <Send className="size-4" />
                            <span className="hidden md:inline">Publish All Valid</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── History ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-900">Import History</h3>
          <Button variant="outline" size="sm" onClick={loadHistory} disabled={loadingHistory}>
            <RefreshCw className={loadingHistory ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
        {loadingHistory ? (
          <ListSkeleton rows={3} />
        ) : !history || history.length === 0 ? (
          <EmptyState icon={FileJson} title="No imports yet" description="Imported question banks will appear here." />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">File</th>
                    <th className="px-4 py-3 text-left font-medium">Topic</th>
                    <th className="px-4 py-3 text-left font-medium">Imported</th>
                    <th className="px-4 py-3 text-left font-medium">Failed</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Date</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900 truncate max-w-[160px]">
                        {h.filename}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{h.topicName}</td>
                      <td className="px-4 py-3 text-emerald-600 font-medium">{h.imported}</td>
                      <td className="px-4 py-3 text-red-600">{h.failed || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">
                        {new Date(h.createdAt).toLocaleDateString(undefined, {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                        {h.admin?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Batch detail dialog (View questions) ────────────────────────── */}
      <Dialog
        open={batchDetail !== null}
        onOpenChange={(v) => {
          if (!v) {
            setBatchDetail(null);
            setBatchDetailQuestions(null);
            setBatchSelectedIds(new Set());
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {batchDetail?.filter === "invalid"
                ? "Invalid questions"
                : batchDetail?.filter === "duplicates"
                  ? "Duplicate questions"
                  : "Questions in batch"}
            </DialogTitle>
            <DialogDescription className="break-all">
              {batchDetail?.batchId}
            </DialogDescription>
          </DialogHeader>

          {batchDetailLoading ? (
            <ListSkeleton rows={5} />
          ) : !batchDetailQuestions || batchDetailQuestions.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No questions in this view"
              description={
                batchDetail?.filter === "invalid"
                  ? "All questions in this batch passed validation."
                  : "Nothing to display."
              }
            />
          ) : (
            <div className="space-y-3">
              {batchSelectedIds.size > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-2.5">
                  <span className="text-sm text-slate-700">
                    <strong>{batchSelectedIds.size}</strong> selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={() =>
                        setBatchBulkTarget({
                          batchId: batchDetail!.batchId,
                          target: "published",
                          scope: "selected",
                        })
                      }
                    >
                      <Send className="size-4" />
                      Publish Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBatchSelectedIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              <div className="rounded-md border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 w-10"></th>
                      <th className="px-3 py-2 text-left font-medium">Question</th>
                      <th className="px-3 py-2 text-left font-medium">Topic</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Validity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchDetailQuestions.map((q) => (
                      <tr key={q.id} className={q.isInvalid ? "bg-red-50/30" : ""}>
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={batchSelectedIds.has(q.id)}
                            onCheckedChange={() => toggleBatchQuestionSelection(q.id)}
                            disabled={q.isInvalid}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900 max-w-md">
                          <div className="line-clamp-2">{q.questionText || "(empty)"}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            A: {q.optionA || "—"} · B: {q.optionB || "—"} · C: {q.optionC || "—"} · D: {q.optionD || "—"} · Ans: {q.correctOption || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-xs">
                          {q.topic.subject.class.name} → {q.topic.subject.name} → {q.topic.name}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={q.status === "published" ? "published" : "draft"}
                            label={q.status === "published" ? "Published" : "Draft"}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {q.isInvalid ? (
                            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                              <XCircle className="size-3" />
                              Invalid
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="size-3" />
                              Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {batchDetailTotal > batchDetailQuestions.length && (
                <p className="text-xs text-slate-500 text-center">
                  Showing {batchDetailQuestions.length} of {batchDetailTotal} questions.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Batch bulk-publish confirmation ─────────────────────────────── */}
      {batchBulkTarget && (
        <Dialog open onOpenChange={(v) => !v && !batchBulkSubmitting && setBatchBulkTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {batchBulkTarget.target === "published"
                  ? `Publish ${batchBulkTarget.scope === "all" ? "all valid drafts" : `${batchSelectedIds.size} selected`} questions?`
                  : `Move ${batchBulkTarget.scope === "all" ? "all" : `${batchSelectedIds.size} selected`} to draft?`}
              </DialogTitle>
              <DialogDescription>
                {batchBulkTarget.scope === "all" ? (
                  <>
                    Only valid questions (all four options + correct answer +
                    non-empty text) will be published. Invalid questions will be
                    reported as needing review and remain in draft.
                  </>
                ) : (
                  <>
                    The {batchSelectedIds.size} selected question(s) will be
                    processed. Invalid ones will be skipped and reported.
                  </>
                )}
                <br /><br />
                This operation is idempotent — running it twice is safe.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => !batchBulkSubmitting && setBatchBulkTarget(null)}
                disabled={batchBulkSubmitting}
              >
                Cancel
              </Button>
              <Button
                className={
                  batchBulkTarget.target === "published"
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                    : "bg-amber-500 hover:bg-amber-600 text-white"
                }
                onClick={executeBatchBulk}
                disabled={batchBulkSubmitting}
              >
                {batchBulkSubmitting && <Loader2 className="size-4 animate-spin" />}
                {batchBulkTarget.target === "published" ? "Publish" : "Move to Draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span className="text-xl font-bold text-slate-900">{value}</span>
      </div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
