"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Compass, Loader2, ChevronRight, AlertTriangle, Search, GraduationCap,
} from "lucide-react";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Explore — discovery area where students can browse ALL published
 * classes, subjects, and topics freely.
 *
 * Browsing does NOT change the student's academic profile.
 * Students can take quizzes from any class — attempts are stored
 * normally but don't affect current-class dashboard statistics.
 */
type ExploreClass = {
  id: string;
  name: string;
  description: string | null;
  subjects: Array<{
    id: string;
    name: string;
    description: string | null;
    _count: { topics: number };
    publishedQuestions: number;
  }>;
};

export function Explore({ user }: { user: PublicUser }) {
  const setView = useViewStore((s) => s.setView);
  const [classes, setClasses] = useState<ExploreClass[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/student/academic", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as { classes: ExploreClass[] };
        if (cancelled) return;
        setClasses(data.classes);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Debounced search filter
  const filteredClasses = useMemo(() => {
    if (!classes) return [];
    if (!search.trim()) return classes;
    const q = search.toLowerCase().trim();
    return classes.map((c) => ({
      ...c,
      subjects: c.subjects.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q)
      ),
    })).filter((c) => c.subjects.length > 0 || c.name.toLowerCase().includes(q));
  }, [classes, search]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }} className="mb-6">
          <p className="text-xs font-medium text-sky-600 uppercase tracking-wider">
            Discovery
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Explore
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Browse all available content. Your academic profile won&apos;t change.
          </p>
        </motion.div>

        {/* Search */}
        {classes && classes.length > 0 && (
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search classes or subjects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
                <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-32 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertTriangle className="size-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : !filteredClasses || filteredClasses.length === 0 ? (
          search ? (
            <EmptyState
              icon={Search}
              title={`No results for "${search}"`}
              description="Try a different search term."
            />
          ) : (
            <EmptyState
              icon={Compass}
              title="Nothing to explore yet"
              description="Published classes will appear here once they're available."
            />
          )
        ) : (
          <div className="space-y-6">
            {filteredClasses.map((klass, cIdx) => (
              <motion.div
                key={klass.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cIdx * 0.05, duration: 0.2 }}
              >
                <h2 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <GraduationCap className="size-4 text-sky-500" />
                  {klass.name}
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {klass.subjects.map((subject, sIdx) => (
                    <motion.button
                      key={subject.id}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: cIdx * 0.05 + sIdx * 0.03 }}
                      whileHover={{ y: -1 }}
                      onClick={() => setView({
                        name: "student-topics",
                        classId: klass.id,
                        subjectId: subject.id,
                      })}
                      className={cn(
                        "text-left rounded-xl border border-slate-200 bg-white p-4 transition-all",
                        "hover:border-sky-300 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm">{subject.name}</p>
                          {subject.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{subject.description}</p>
                          )}
                          <p className="text-xs text-sky-600 mt-1">
                            {subject._count.topics} topics · {subject.publishedQuestions} questions
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-slate-300 shrink-0" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
