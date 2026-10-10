"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Flag, Circle, X, Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * QuestionNavigator — a collapsible grid palette showing all questions
 * in the quiz with color-coded status indicators.
 *
 * Inspired by exam platforms (GRE, GMAT, Kaplan):
 *   - Green dot = answered
 *   - Amber dot = flagged for review
 *   - Slate dot = unanswered
 *   - Ring = current question
 *
 * Click any dot to jump to that question.
 */
export function QuestionNavigator({
  total,
  currentIndex,
  answeredIds,
  flaggedIds,
  questionIds,
  open,
  onToggle,
  onJump,
}: {
  total: number;
  currentIndex: number;
  answeredIds: Set<string>;
  flaggedIds: Set<string>;
  questionIds: string[];
  open: boolean;
  onToggle: () => void;
  onJump: (index: number) => void;
}) {
  const answeredCount = answeredIds.size;
  const flaggedCount = flaggedIds.size;
  const remaining = total - answeredCount;

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "fixed right-4 bottom-4 z-30 size-11 rounded-full shadow-lg flex items-center justify-center transition-all",
          "bg-slate-900 text-white hover:bg-slate-800 hover:scale-105",
          open && "bg-emerald-500 hover:bg-emerald-600"
        )}
        title="Question navigator"
        aria-label="Toggle question navigator"
      >
        <Grid3x3 className="size-5" />
        {answeredCount > 0 && (
          <span className="absolute -top-1 -right-1 size-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {answeredCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-4 bottom-16 z-30 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Questions
              </h3>
              <button
                type="button"
                onClick={onToggle}
                className="size-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Summary bar */}
            <div className="flex items-center gap-3 mb-3 text-xs">
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Check className="size-3" /> {answeredCount}
              </span>
              <span className="inline-flex items-center gap-1 text-amber-600">
                <Flag className="size-3" /> {flaggedCount}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Circle className="size-3" /> {remaining}
              </span>
            </div>

            {/* Grid of question dots */}
            <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto">
              {Array.from({ length: total }).map((_, i) => {
                const qId = questionIds[i];
                const isAnswered = qId ? answeredIds.has(qId) : false;
                const isFlagged = qId ? flaggedIds.has(qId) : false;
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onJump(i);
                      onToggle();
                    }}
                    className={cn(
                      "size-8 rounded-lg text-xs font-semibold transition-all flex items-center justify-center",
                      isCurrent && "ring-2 ring-emerald-500 ring-offset-1",
                      isAnswered && !isFlagged && "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
                      isAnswered && isFlagged && "bg-amber-100 text-amber-700 hover:bg-amber-200",
                      !isAnswered && isFlagged && "bg-amber-50 text-amber-600 border border-amber-300 hover:bg-amber-100",
                      !isAnswered && !isFlagged && "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                    title={`Question ${i + 1}${isAnswered ? " (answered)" : ""}${isFlagged ? " (flagged)" : ""}`}
                  >
                    {isAnswered ? (
                      <Check className="size-3.5" />
                    ) : isFlagged ? (
                      <Flag className="size-3" />
                    ) : (
                      i + 1
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded bg-emerald-200" /> Answered
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded bg-amber-200" /> Flagged
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded bg-slate-200" /> Unanswered
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
