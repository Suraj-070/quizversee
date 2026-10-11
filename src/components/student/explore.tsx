"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BookOpen, ChevronRight, Compass, Search } from "lucide-react";
import type { PublicUser } from "@/types";
import { useViewStore } from "@/stores/view-store";
import { StudentHeader } from "@/components/student/student-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LibraryTopic = {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
};

/** External and supplementary discovery, without changing a student's profile. */
export function Explore({ user }: { user: PublicUser }) {
  const setView = useViewStore((state) => state.setView);
  const [topics, setTopics] = useState<LibraryTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/student/explore", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load the practice library.");
        const data = (await response.json()) as { topics: LibraryTopic[] };
        if (!cancelled) setTopics(data.topics);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load the practice library.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reload]);

  const groups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const matching = topics.filter((topic) =>
      !query || [topic.name, topic.description ?? "", topic.subjectName, topic.className]
        .some((value) => value.toLocaleLowerCase().includes(query))
    );
    const grouped = new Map<string, { className: string; subjectName: string; topics: LibraryTopic[] }>();
    for (const topic of matching) {
      const key = `${topic.classId}:${topic.subjectId}`;
      const group = grouped.get(key) ?? {
        className: topic.className,
        subjectName: topic.subjectName,
        topics: [],
      };
      group.topics.push(topic);
      grouped.set(key, group);
    }
    return [...grouped.values()].sort(
      (a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName)
    );
  }, [topics, search]);

  const resultCount = groups.reduce((count, group) => count + group.topics.length, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentHeader user={user} />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Supplementary library</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Explore</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Discover published practice topics across classes and subjects. Your current class and selected subjects stay unchanged.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setView({ name: "my-learning" })}>
              <BookOpen className="size-4" /> My Learning
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setView({ name: "extra-practice" })}>
              Practice my subjects <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="relative mb-6 max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="Search supplementary practice topics"
            placeholder="Search topics, subjects or classes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-4 w-2/5 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-3/4 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Could not load the library"
            description={error}
            action={<Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>Try again</Button>}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={search ? Search : Compass}
            title={search ? "No matching topics" : "No supplementary practice available yet"}
            description={search
              ? "Try a different topic, subject or class name."
              : "Once supplementary questions are reviewed and published, they will appear here."}
            action={search ? <Button variant="outline" size="sm" onClick={() => setSearch("")}>Clear search</Button> : undefined}
          />
        ) : (
          <div className="space-y-8">
            <p className="text-xs text-slate-500" aria-live="polite">{resultCount} topics available</p>
            {groups.map((group, index) => (
              <motion.section
                key={`${group.className}:${group.subjectName}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.18) }}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-900">{group.subjectName}</span>
                  <span className="text-slate-400" aria-hidden="true">·</span>
                  <span className="text-slate-500">{group.className}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.topics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setView({ name: "quiz-setup", topicId: topic.id })}
                      className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-card transition-all hover:border-sky-300 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <div className="min-w-0">
                        <h2 className="font-semibold text-slate-900">{topic.name}</h2>
                        {topic.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{topic.description}</p>}
                        <p className="mt-3 text-xs font-medium text-sky-700">{topic.questionCount} published questions</p>
                      </div>
                      <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </motion.section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
