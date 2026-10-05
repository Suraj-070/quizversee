"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
};

export function AdminImports() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

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

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Import failed");
      }
      const data = (await res.json()) as ImportResult;
      setResult(data);
      setPreview(null);
      toast.success(`${data.imported} questions imported to ${data.topicName}`);
      await loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Import Center</h2>
        <p className="text-sm text-slate-600 mt-1">
          Upload a JSON question bank file. Preview and validate before importing.
        </p>
      </div>

      {/* Upload area */}
      {!preview && !result && (
        <div
          onClick={() => fileRef.current?.click()}
          className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
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
              Import {preview.validation.valid} Questions
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
          </p>
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

      {/* History */}
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
