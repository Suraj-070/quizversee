"use client";

import { useEffect, useState } from "react";
import { AlertCircle, BookOpen, Check, Compass, GraduationCap, Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useViewStore } from "@/stores/view-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AcademicClass = {
  id: string;
  name: string;
  description: string | null;
  subjects: Array<{ id: string; name: string; description: string | null }>;
};
type AcademicProfile = {
  currentClassId: string | null;
  subjects: Array<{ id: string }>;
};

/** Keep grade & subject editing on the student's own profile. */
export function LearningPreferences() {
  const setView = useViewStore((s) => s.setView);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [savedClassId, setSavedClassId] = useState("");
  const [savedSubjectIds, setSavedSubjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const hasChanges = classId !== savedClassId ||
    [...subjectIds].sort().join(",") !== [...savedSubjectIds].sort().join(",");
  const currentClass = classes.find((item) => item.id === classId);
  const subjects = currentClass?.subjects ?? [];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [classResponse, profileResponse] = await Promise.all([
          fetch("/api/student/academic", { cache: "no-store" }),
          fetch("/api/student/academic-profile", { cache: "no-store" }),
        ]);
        if (!classResponse.ok || !profileResponse.ok) throw new Error("Could not load your learning preferences.");
        const classData = await classResponse.json() as { classes: AcademicClass[] };
        const profileData = await profileResponse.json() as AcademicProfile;
        if (cancelled) return;
        const currentId = profileData.currentClassId ?? "";
        const selected = profileData.subjects.map((subject) => subject.id);
        setClasses(classData.classes);
        setClassId(currentId);
        setSavedClassId(currentId);
        setSubjectIds(selected);
        setSavedSubjectIds(selected);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load subjects.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [retry]);

  function changeClass(id: string) {
    if (classId === id) return;
    setClassId(id);
    setSubjectIds([]);
    setError(null);
  }
  function toggleSubject(id: string) {
    setSubjectIds((current) => current.includes(id)
      ? current.filter((subjectId) => subjectId !== id)
      : [...current, id]);
  }
  async function save() {
    if (!hasChanges || !classId || subjectIds.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/student/academic-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, subjectIds }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Could not save your class and subjects.");
      }
      setSavedClassId(classId);
      setSavedSubjectIds(subjectIds);
      toast.success("Your learning preferences were updated.");
      // Refresh the shell so the dashboard uses the new academic selection.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save your learning preferences.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">My learning preferences</h2>
            <p className="mt-1 text-sm text-slate-600">
              Update your current class and the subjects shown in My Learning.
            </p>
          </div>
        </div>
        {!loading && currentClass && !error && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
          {currentClass.name} · {subjectIds.length} selected
        </span>}
      </div>

      {loading ? (
        <div role="status" className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading classes and subjects…
        </div>
      ) : error && classes.length === 0 ? (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mr-2 inline size-4" /> {error}
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setRetry((n) => n + 1)}>
            <RefreshCw className="size-4" /> Retry
          </Button>
        </div>
      ) : (
        <>
          <h3 className="mb-2 text-sm font-medium text-slate-900">Current class</h3>
          <div role="group" aria-label="Choose your class" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {classes.map((item) => <button key={item.id} type="button" aria-pressed={classId === item.id}
              onClick={() => changeClass(item.id)}
              className={cn("rounded-xl border px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                classId === item.id ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-700 hover:border-emerald-300")}>
              {item.name}
            </button>)}
          </div>
          <h3 className="mb-1 text-sm font-medium text-slate-900">My subjects</h3>
          <p className="mb-3 text-xs text-slate-500">
            Your quiz history is preserved when you change classes or subjects.
          </p>
          {!classId ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Choose a class above to see its subjects.
          </p> : subjects.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            This class has no published curriculum subjects yet.
          </p> : <div role="group" aria-label="Choose your subjects" className="grid gap-2 sm:grid-cols-2">
            {subjects.map((subject) => {
              const selected = subjectIds.includes(subject.id);
              return <button key={subject.id} type="button" aria-pressed={selected} onClick={() => toggleSubject(subject.id)}
                className={cn("flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-300")}>
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded border",
                  selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300")}>
                  {selected && <Check className="size-3.5" />}
                </span>
                <span className="font-medium text-slate-800">{subject.name}</span>
              </button>;
            })}
          </div>}
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span aria-live="polite" className="text-xs text-slate-500">
              {hasChanges ? "You have unsaved learning changes" : "Your learning choices are up to date"}
            </span>
            <div className="flex gap-2">
              {hasChanges && <Button variant="outline" size="sm" disabled={saving}
                onClick={() => { setClassId(savedClassId); setSubjectIds(savedSubjectIds); setError(null); }}>
                Cancel
              </Button>}
              <Button size="sm" onClick={save} disabled={!hasChanges || !classId || !subjectIds.length || saving}
                className="bg-emerald-600 text-white hover:bg-emerald-700">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save learning choices
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
    <section aria-label="Learning shortcuts" className="mb-6 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => setView({ name: "my-learning" })}
        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-emerald-700" />
        <span><span className="block text-sm font-semibold text-slate-900">My Learning</span>
          <span className="mt-1 block text-xs text-slate-600">Curriculum questions for your selected subjects</span></span>
      </button>
      <button type="button" onClick={() => setView({ name: "extra-practice" })}
        className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <Compass className="mt-0.5 size-5 shrink-0 text-sky-700" />
        <span><span className="block text-sm font-semibold text-slate-900">Extra Practice</span>
          <span className="mt-1 block text-xs text-slate-600">Supplementary content for your subjects</span></span>
      </button>
    </section>
  </>;
}
