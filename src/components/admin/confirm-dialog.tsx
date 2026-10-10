"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * ConfirmDialog — a destructive-action confirmation modal.
 *
 * Per PRD §41 (Admin Delete Safety): never delete important content from
 * a single click. Show a confirmation modal that also lists affected
 * child counts (e.g. "This subject contains 8 topics and 42 questions")
 * so the admin understands the blast radius before confirming.
 *
 * The component fetches the affected counts from a provided async
 * function when the dialog opens. The counts are then formatted and
 * displayed alongside the warning text.
 */

export type AffectedCounts = Record<string, number>;

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  fetchCounts,
  countLabels,
  entityName,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  /**
   * Optional async function that returns the affected child counts.
   * Called when the dialog opens.
   */
  fetchCounts?: () => Promise<AffectedCounts>;
  /**
   * Mapping of count key → human label, e.g.
   * { questions: "questions", topics: "topics" }
   */
  countLabels?: Record<string, string>;
  /** Name of the entity being deleted (e.g. "Force and Motion") */
  entityName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<AffectedCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !fetchCounts) {
      setCounts(null);
      return;
    }
    let cancelled = false;
    setLoadingCounts(true);
    fetchCounts()
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingCounts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fetchCounts]);

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  const affectedLines = counts
    ? Object.entries(counts)
        .filter(([, v]) => v > 0)
        .map(([key, v]) => `${v} ${countLabels?.[key] ?? key}`)
    : [];

  const hasAffected = affectedLines.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {destructive ? (
              <AlertTriangle className="size-5 text-red-500" />
            ) : null}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-slate-600">
              {description && <p>{description}</p>}

              {entityName && (
                <p>
                  You are about to delete{" "}
                  <span className="font-semibold text-slate-900">
                    {entityName}
                  </span>
                  .
                </p>
              )}

              {loadingCounts && (
                <p className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="size-3 animate-spin" />
                  Checking affected content…
                </p>
              )}

              {hasAffected && !loadingCounts && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800">
                  <p className="font-medium">This will also delete:</p>
                  <ul className="mt-1 list-disc list-inside">
                    {affectedLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-amber-700">
                    Cascading deletes are enabled. This action cannot be undone.
                  </p>
                </div>
              )}

              {!hasAffected && !loadingCounts && (
                <p className="text-xs text-slate-500">
                  No child content will be affected. This action cannot be undone.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={submitting}
            className={
              destructive
                ? "bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-500/30"
                : undefined
            }
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {destructive ? <Trash2 className="size-4" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A button-styled trigger that pairs naturally with ConfirmDialog for
 * table row actions. Pre-styled as ghost + destructive red on hover.
 */
export function ConfirmDialogTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={
        "text-red-600 hover:text-red-700 hover:bg-red-50 " + (className ?? "")
      }
    >
      {children}
    </Button>
  );
}
