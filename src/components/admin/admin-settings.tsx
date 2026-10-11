"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, ChevronRight, ClipboardList, Loader2, RotateCcw, Save, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useViewStore } from "@/stores/view-store";
import { DEFAULT_QUIZ_COUNTS, normalizeQuizCounts, chooseQuizCount, type QuizFeedbackMode } from "@/lib/quiz-preferences";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COUNTS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
type FormValues = {
  quiz_question_counts: number[];
  quiz_default_count: number;
  quiz_default_topic_feedback: QuizFeedbackMode;
  quiz_default_subject_feedback: QuizFeedbackMode;
  quiz_smart_practice_enabled: boolean;
};
function fromServer(settings: Record<string, unknown>): FormValues {
  const counts = normalizeQuizCounts(settings.quiz_question_counts ?? [...DEFAULT_QUIZ_COUNTS]);
  const preferred = settings.quiz_default_count;
  return {
    quiz_question_counts: counts,
    quiz_default_count: typeof preferred === "number" && counts.includes(preferred) ? preferred : chooseQuizCount(counts, 10) ?? 1,
    quiz_default_topic_feedback: settings.quiz_default_topic_feedback === "exam" ? "exam" : "immediate",
    quiz_default_subject_feedback: settings.quiz_default_subject_feedback === "immediate" ? "immediate" : "exam",
    quiz_smart_practice_enabled: settings.quiz_smart_practice_enabled !== false,
  };
}
export function AdminSettings() {
  const setView = useViewStore((s) => s.setView);
  const [values, setValues] = useState<FormValues>(() => fromServer({}));
  const [saved, setSaved] = useState<FormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const hasChanges = saved !== null && JSON.stringify(values) !== JSON.stringify(saved);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/settings", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load settings");
        const data = await response.json() as { settings?: Record<string, unknown> };
        if (!cancelled) {
          const next = fromServer(data.settings ?? {});
          setValues(next);
          setSaved(next);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [retry]);

  function toggleCount(n: number) {
    if (n === 1) return;
    setValues((prev) => {
      const counts = normalizeQuizCounts(prev.quiz_question_counts.includes(n)
        ? prev.quiz_question_counts.filter((x) => x !== n) : [...prev.quiz_question_counts, n]);
      return { ...prev, quiz_question_counts: counts,
        quiz_default_count: counts.includes(prev.quiz_default_count) ? prev.quiz_default_count : chooseQuizCount(counts, 10) ?? 1 };
    });
  }

  async function save() {
    if (saving || !hasChanges) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Could not save settings");
      }
      setSaved(values);
      toast.success("Settings saved. New quizzes will use these defaults.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save settings";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-slate-600">
    <Loader2 className="size-5 animate-spin text-emerald-500" /> Loading settings…
  </div>;

  if (error && !saved) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6">
    <p className="font-medium text-red-800">{error}</p>
    <Button className="mt-3" variant="outline" onClick={() => setRetry((n) => n + 1)}>Try again</Button>
  </div>;

  return <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Administration</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-600">Set helpful defaults while keeping student practice flexible.</p>
      </div>
      <div className="flex gap-2">
        {hasChanges && <Button variant="outline" disabled={saving} onClick={() => saved && setValues(saved)}>
          <RotateCcw className="size-4" /> Discard</Button>}
        <Button onClick={save} disabled={!hasChanges || saving} className="bg-emerald-600 text-white hover:bg-emerald-700">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes</Button>
      </div>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <SlidersHorizontal className="size-5" /></div>
        <div>
          <h3 className="font-semibold text-slate-900">Question count options</h3>
          <p className="mt-0.5 text-sm text-slate-600">Choose which sizes appear before quizzes and exams. Unavailable sizes are disabled for students.</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
        {COUNTS.map((count) => {
          const selected = values.quiz_question_counts.includes(count);
          return <button key={count} type="button" disabled={count === 1} aria-pressed={selected}
            aria-label={count === 1 ? "1 question, always available" : String(count) + " questions, " + (selected ? "enabled" : "disabled")}
            onClick={() => toggleCount(count)}
            className={cn("relative flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              selected ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300",
              count === 1 && "cursor-default")}>
            <span className="text-xl font-semibold tabular-nums">{count}</span>
            <span className="text-[11px]">{count === 1 ? "Always on" : selected ? "Enabled" : "Off"}</span>
            {selected && <Check aria-hidden="true" className="absolute right-2 top-2 size-3.5 text-emerald-600" />}
          </button>;
        })}
      </div>
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div><label htmlFor="default-quiz-count" className="font-medium text-sm text-slate-900">Default question count</label>
          <p className="text-xs text-slate-500">Preselected on setup; automatically reduced when a topic has fewer questions.</p></div>
        <select id="default-quiz-count" value={values.quiz_default_count}
          onChange={(e) => setValues((v) => ({ ...v, quiz_default_count: Number(e.target.value) }))}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-48">
          {values.quiz_question_counts.map((n) => <option key={n} value={n}>{n} {n === 1 ? "question" : "questions"}</option>)}
        </select>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
      <div>
        <h3 className="font-semibold text-slate-900">Feedback experience</h3>
        <p className="mt-0.5 text-sm text-slate-600">Choose the default reveal timing for each quiz type; students can change it before starting.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {([
          ["quiz_default_topic_feedback", "Topic quiz", "Questions from one topic"],
          ["quiz_default_subject_feedback", "Subject exam", "Questions from across the subject"],
        ] as const).map(([key, title, subtitle]) => <div key={key} className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">{subtitle}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["immediate", "exam"] as const).map((mode) => <button key={mode} type="button" aria-pressed={values[key] === mode}
              onClick={() => setValues((v) => ({ ...v, [key]: mode }))}
              className={cn("rounded-lg border px-3 py-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                values[key] === mode ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300")}>
              {mode === "immediate" ? "After each answer" : "At the end"}</button>)}
          </div>
        </div>)}
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
        <Sparkles className="size-5 text-violet-700" />
        <div className="min-w-0 flex-1">
          <label htmlFor="smart-practice-switch" className="text-sm font-medium text-slate-900">Allow Smart Practice</label>
          <p className="mt-0.5 text-xs text-slate-500">Let students prioritize previously missed and less-practiced topic questions.</p>
        </div>
        <Switch id="smart-practice-switch" checked={values.quiz_smart_practice_enabled}
          onCheckedChange={(checked) => setValues((v) => ({ ...v, quiz_smart_practice_enabled: checked }))} />
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <h3 className="font-semibold text-slate-900">Site & classroom management</h3>
      <p className="mt-1 text-sm text-slate-600">Other admin controls, gathered here for convenience.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setView({ name: "admin-site-content" })}
          className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <BookOpen className="size-5 text-emerald-600" />
          <span className="flex-1"><span className="block text-sm font-medium text-slate-900">Homepage & site content</span>
            <span className="block text-xs text-slate-500">Edit headings, descriptions, and contact details</span></span>
          <ChevronRight className="size-4 text-slate-400" />
        </button>
        <button type="button" onClick={() => setView({ name: "admin-announcements" })}
          className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <ClipboardList className="size-5 text-sky-600" />
          <span className="flex-1"><span className="block text-sm font-medium text-slate-900">Student announcements</span>
            <span className="block text-xs text-slate-500">Publish and manage notices</span></span>
          <ChevronRight className="size-4 text-slate-400" />
        </button>
      </div>
    </section>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-100 px-4 py-3">
      <p aria-live="polite" className="text-xs text-slate-600">{hasChanges ? "You have unsaved changes." : "All changes saved."}</p>
      <Button onClick={save} disabled={!hasChanges || saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings</Button>
    </div>
  </div>;
}
