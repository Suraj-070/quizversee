"use client";

import { motion } from "framer-motion";
import {
  GraduationCap,
  ChevronRight,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import type { AcademicClass } from "@/types";
import { cn } from "@/lib/utils";

/**
 * ClassCard — used on the student's "Choose a class" screen.
 * Clicking the card navigates the student to the subjects for that class.
 *
 * The card is intentionally large and tap-friendly (per PRD §38: large
 * touch targets on mobile).
 */
export type StudentClass = AcademicClass & {
  subjects: Array<{
    id: string;
    name: string;
    publishedQuestions: number;
  }>;
};

export function ClassCard({
  klass,
  index,
  onClick,
}: {
  klass: StudentClass;
  index: number;
  onClick: () => void;
}) {
  const subjectCount = klass.subjects.length;
  const totalQuestions = klass.subjects.reduce(
    (sum, s) => sum + s.publishedQuestions,
    0
  );

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "group w-full text-left",
        "rounded-2xl border border-slate-200/60 bg-white p-5 sm:p-6 shadow-card",
        "hover:shadow-md hover:border-emerald-300 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {klass.name}
            </h3>
            {klass.description ? (
              <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                {klass.description}
              </p>
            ) : null}
          </div>
        </div>
        <ChevronRight className="size-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <BookOpen className="size-3.5" />
          {subjectCount} {subjectCount === 1 ? "subject" : "subjects"}
        </span>
        <span className="inline-flex items-center gap-1">
          <HelpCircle className="size-3.5" />
          {totalQuestions} questions
        </span>
      </div>
    </motion.button>
  );
}
