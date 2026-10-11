"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Sparkles, Check, Loader2, ArrowRight, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * AcademicOnboarding — first-time setup flow for new students.
 *
 * Steps:
 *   1. Welcome screen
 *   2. Choose current class (from published, active classes)
 *   3. Choose subjects (from the selected class, if >1 available)
 *   4. Success → dashboard
 *
 * Existing users without academic profile also go through this flow.
 * Their previous quiz history/bookmarks are preserved.
 */

type ClassInfo = { id: string; name: string; description: string | null };
type SubjectInfo = {
  id: string; name: string; description: string | null; icon: string | null;
};

export function AcademicOnboarding({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [step, setStep] = useState(0); // 0=welcome, 1=class, 2=subjects, 3=done
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState(false);

  // Load classes on mount
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/student/academic", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { classes: Array<{ id: string; name: string; description: string | null; subjects: unknown[] }> };
        setClasses(data.classes.map((c) => ({ id: c.id, name: c.name, description: c.description })));
      } catch {
        toast.error("Failed to load classes");
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, []);

  // Load subjects when a class is selected
  useEffect(() => {
    if (!selectedClass) return;
    let cancelled = false;
    async function loadSubjects() {
      setSubjectsLoading(true);
      setSubjectsError(false);
      setSubjects([]);
      try {
        const res = await fetch(`/api/student/subjects?classId=${selectedClass}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { subjects: SubjectInfo[] };
        if (!cancelled) setSubjects(data.subjects);
      } catch {
        if (!cancelled) { setSubjectsError(true); toast.error("Failed to load subjects"); }
      } finally {
        if (!cancelled) setSubjectsLoading(false);
      }
    }
    loadSubjects();
    return () => { cancelled = true; };
  }, [selectedClass]);

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!selectedClass || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/student/academic-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClass,
          subjectIds: Array.from(selectedSubjects),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save");
      }
      setStep(3); // success
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleContinue() {
    setView({ name: "student-home" });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-teal-50 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, oklch(0.5 0.15 160) 1px, transparent 1px), radial-gradient(circle at 75% 75%, oklch(0.5 0.15 180) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="w-full max-w-lg relative z-10">
        <AnimatePresence mode="wait">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                className="size-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25"
              >
                <GraduationCap className="size-8" />
              </motion.div>
              <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
                Welcome to Quizverse
              </h1>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Let&apos;s personalize your learning experience. Tell us what
                you&apos;re currently studying so we can show you the right
                subjects, topics and quizzes.
              </p>
              <Button
                size="lg"
                className="mt-8 bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={() => setStep(1)}
              >
                Get Started
                <ArrowRight className="size-5" />
              </Button>
            </motion.div>
          )}

          {/* Step 1: Choose class */}
          {step === 1 && (
            <motion.div
              key="class"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-medium mb-3">
                  Step 1 of 2
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  What class are you studying in?
                </h2>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-emerald-500" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {classes.map((c, idx) => (
                    <motion.button
                      key={c.id}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setSelectedClass(c.id);
                        setSelectedSubjects(new Set());
                        // If only 1 subject, auto-advance; otherwise go to subject selection
                        setStep(2);
                      }}
                      className={cn(
                        "rounded-2xl border-2 p-5 text-center transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                        selectedClass === c.id
                          ? "border-emerald-500 bg-emerald-50 shadow-glow-emerald"
                          : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
                      )}
                    >
                      <div className="size-10 mx-auto rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center mb-2">
                        <GraduationCap className="size-5" />
                      </div>
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      {c.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.description}</p>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}

              {classes.length === 0 && !loading && (
                <p className="text-center text-slate-500 text-sm py-8">
                  No classes are available yet. Please check back later.
                </p>
              )}
            </motion.div>
          )}

          {/* Step 2: Choose subjects */}
          {step === 2 && (
            <motion.div
              key="subjects"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-medium mb-3">
                  Step 2 of 2
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Choose your subjects
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Select the subjects you study. You can change these later.
                </p>
              </div>

              {subjectsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-emerald-500" />
                </div>
              ) : subjects.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-slate-600">{subjectsError ? "Unable to load subjects. Select your class again to retry." : "No subjects are available for this class yet."}</p>
                  <Button variant="outline" onClick={() => setStep(1)}>Choose another class</Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {subjects.map((s, idx) => {
                      const selected = selectedSubjects.has(s.id);
                      return (
                        <motion.button
                          key={s.id}
                          type="button"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          onClick={() => toggleSubject(s.id)}
                          className={cn(
                            "w-full rounded-xl border-2 p-4 flex items-center gap-3 transition-all text-left",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                            selected
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 bg-white hover:border-emerald-300"
                          )}
                        >
                          <div className={cn(
                            "size-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                            selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                          )}>
                            {selected && <Check className="size-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900">{s.name}</p>
                            {s.description && (
                              <p className="text-xs text-slate-500 line-clamp-1">{s.description}</p>
                            )}
                          </div>
                          {s.icon && <BookOpen className="size-4 text-slate-400 shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                      disabled={saving || selectedSubjects.size === 0}
                      onClick={handleSave}
                    >
                      {saving ? (
                        <><Loader2 className="size-4 animate-spin" /> Saving…</>
                      ) : (
                        <>Save & Continue <ArrowRight className="size-4" /></>
                      )}
                    </Button>
                  </div>


                </>
              )}
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                className="size-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center"
              >
                <Check className="size-8 text-emerald-600" />
              </motion.div>
              <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
                You&apos;re all set!
              </h1>
              <p className="mt-2 text-slate-600">
                Your Quizverse experience is ready.
              </p>
              <Button
                size="lg"
                className="mt-8 bg-emerald-500 hover:bg-emerald-600 text-white"
                onClick={handleContinue}
              >
                <Sparkles className="size-5" />
                Start Learning
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
