"use client";

import { motion } from "framer-motion";
import {
  HelpCircle,
  ChevronRight,
  Trophy,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TopicCard — used on the student's "Choose a topic" screen.
 *
 * Shows the topic name, the count of published questions, and (if the
 * student has attempted it before) their last score. Clicking navigates
 * to the quiz setup screen (Phase 5).
 *
 * Per PRD §19: optionally show the user's previous score/progress.
 */

export type StudentTopic = {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  publishedQuestions: number;
  lastAttempt: {
    id: string;
    totalQuestions: number;
    correctAnswers: number;
    scorePercentage: number;
    completedAt: string;
  } | null;
};

export function TopicCard({
  topic,
  index,
  onClick,
}: {
  topic: StudentTopic;
  index: number;
  onClick: () => void;
}) {
  const noQuestions = topic.publishedQuestions === 0;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={noQuestions}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={noQuestions ? undefined : { y: -2 }}
      whileTap={noQuestions ? undefined : { scale: 0.99 }}
      className={cn(
        "group w-full text-left",
        "rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
        noQuestions
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-md hover:border-emerald-300"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "size-11 rounded-xl text-white flex items-center justify-center shadow-sm",
              noQuestions
                ? "bg-slate-300 shadow-none"
                : "bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/20"
            )}
          >
            <Layers className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {topic.name}
            </h3>
            {topic.description ? (
              <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                {topic.description}
              </p>
            ) : null}
          </div>
        </div>
        <ChevronRight
          className={cn(
            "size-5 transition-all",
            noQuestions
              ? "text-slate-300"
              : "text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5"
          )}
        />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            noQuestions ? "text-slate-400" : "text-slate-500"
          )}
        >
          <HelpCircle className="size-3.5" />
          {topic.publishedQuestions}{" "}
          {topic.publishedQuestions === 1 ? "question" : "questions"}
          {noQuestions && " available soon"}
        </span>

        {topic.lastAttempt && (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Trophy className="size-3.5" />
            Last: {topic.lastAttempt.correctAnswers}/
            {topic.lastAttempt.totalQuestions} (
            {Math.round(topic.lastAttempt.scorePercentage)}%)
          </span>
        )}
      </div>
    </motion.button>
  );
}
