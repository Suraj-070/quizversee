"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  ChevronRight,
  Layers,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SubjectCard — used on the student's "Choose a subject" screen.
 *
 * NOTE: the database `icon` field is a lucide icon name (e.g.
 * "flask-conical"). Dynamically resolving icons from a string at render
 * time conflicts with the `react-hooks/static-components` ESLint rule.
 * For Phase 4 we render a single consistent icon (BookOpen). A proper
 * icon registry will be added in Phase 8 (Polish) — it will pre-bind a
 * fixed set of icon names to components at module load, avoiding the
 * rule violation entirely.
 */

export type StudentSubject = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  _count: { topics: number };
  publishedQuestions: number;
};

export function SubjectCard({
  subject,
  index,
  onClick,
}: {
  subject: StudentSubject;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "group w-full text-left",
        "rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm",
        "hover:shadow-md hover:border-emerald-300 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white flex items-center justify-center shadow-sm shadow-violet-500/20">
            <BookOpen className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {subject.name}
            </h3>
            {subject.description ? (
              <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                {subject.description}
              </p>
            ) : null}
          </div>
        </div>
        <ChevronRight className="size-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Layers className="size-3.5" />
          {subject._count.topics}{" "}
          {subject._count.topics === 1 ? "topic" : "topics"}
        </span>
        <span className="inline-flex items-center gap-1">
          <HelpCircle className="size-3.5" />
          {subject.publishedQuestions} questions
        </span>
      </div>
    </motion.button>
  );
}
