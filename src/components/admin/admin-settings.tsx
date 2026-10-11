"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Loader2,
  Check,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * AdminSettings — configuration page.
 *
 * Currently manages:
 *   - quiz_question_counts: which question counts are available
 *     to students (e.g. 10, 20, 30, 40, 50). Toggle each on/off.
 *
 * Future settings can be added here (e.g. default feedback mode,
 * pass mark, etc.).
 */

const ALL_POSSIBLE_COUNTS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

export function AdminSettings() {
  const [enabledCounts, setEnabledCounts] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultFeedback, setDefaultFeedback] = useState<"immediate" | "exam">("immediate");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        const counts = data.settings?.quiz_question_counts;
        setDefaultFeedback(data.settings?.default_feedback_mode === "exam" ? "exam" : "immediate");
        if (Array.isArray(counts)) {
          setEnabledCounts(counts);
        } else {
          // default
          setEnabledCounts([10, 20, 30, 40, 50]);
        }
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggleCount(n: number) {
    setEnabledCounts((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)
    );
  }

  async function handleSave() {
    if (saving) return;
    if (enabledCounts.length === 0) {
      toast.error("Enable at least one question count.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_question_counts: enabledCounts,
          default_feedback_mode: defaultFeedback,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save");
      }
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-600 mt-1">
          Configure quiz behavior for students.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Default feedback mode</h3>
        <p className="text-sm text-slate-500 mt-1 mb-3">Choose what students see first when starting a topic quiz. Students can still switch modes.</p>
        <select
          value={defaultFeedback}
          onChange={(e) => setDefaultFeedback(e.target.value as "immediate" | "exam")}
          className="w-full sm:w-72 rounded-lg border border-slate-300 p-2 text-sm bg-white"
          aria-label="Default quiz feedback mode"
        >
          <option value="immediate">Practice — reveal after answering</option>
          <option value="exam">Exam — reveal after completion</option>
        </select>
      </section>

      {/* Quiz question counts */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <SettingsIcon className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Allowed Question Counts
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Choose which preset quantities students see when
              starting a quiz. Counts that exceed the available published
              questions are automatically disabled. Students can also choose a custom count from 1 to the available total.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {ALL_POSSIBLE_COUNTS.map((n) => {
            const enabled = enabledCounts.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleCount(n)}
                aria-pressed={enabled}
                aria-label={`${n} question preset ${enabled ? "enabled" : "disabled"}`}
                className={cn(
                  "rounded-xl border-2 p-4 text-center transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                  !enabled &&
                    "border-slate-200 bg-white hover:border-emerald-300",
                  enabled &&
                    "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
                )}
              >
                <div
                  className={cn(
                    "text-xl font-bold",
                    enabled ? "text-emerald-700" : "text-slate-400"
                  )}
                >
                  {n}
                </div>
                <div className="mt-1 flex items-center justify-center">
                  <span aria-hidden="true" className={cn("flex items-center justify-center rounded-full size-6 text-xs font-semibold", enabled ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400")}>{enabled ? <Check className="size-4" /> : "–"}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Currently enabled: {enabledCounts.join(", ") || "none"}
          </p>
          <Button
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
