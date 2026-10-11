import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { normalizeQuizCounts, chooseQuizCount, parseStoredSetting, quizFeedbackSetting } from "@/lib/quiz-preferences";

/**
 * GET /api/student/subject-questions?subjectId=<id>
 *
 * Returns the total published-question count across ALL topics in a
 * subject, plus the allowed quiz counts (from the Setting).
 *
 * Used by the SubjectQuizSetup screen to render the count picker with
 * availability logic — same as the topic-level quiz setup, but
 * aggregated across all topics in the subject.
 */
export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json(
      { error: "subjectId is required" },
      { status: 400 }
    );
  }

  // Verify subject is active
  const subject = await db.subject.findFirst({
    where: { id: subjectId, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      class: { select: { id: true, name: true } },
      _count: { select: { topics: { where: { isActive: true, archivedAt: null, contentType: "curriculum" } } } },
    },
  });
  if (!subject) {
    return NextResponse.json(
      { error: "Subject not found or not available" },
      { status: 404 }
    );
  }

  // Count ALL published questions across all active topics in this subject
  const publishedCount = await db.question.count({
    where: {
      status: "published",
      archivedAt: null,
      contentType: "curriculum",
      topic: { subjectId, isActive: true, archivedAt: null, contentType: "curriculum" },
    },
  });

  // A one-question quick practice is always available, even on a new or
  // small topic. Admin settings control the additional selectable counts.
  const settings = await db.setting.findMany({
    where: { key: { in: ["quiz_question_counts", "quiz_default_count", "quiz_default_subject_feedback", "quiz_smart_practice_enabled"] } },
  });
  const values = new Map(settings.map((setting) => [setting.key, parseStoredSetting(setting.value)]));
  const allowedCounts = normalizeQuizCounts(values.get("quiz_question_counts"));
  const preferred = values.get("quiz_default_count");
  const preferredCount = typeof preferred === "number" && allowedCounts.includes(preferred) ? preferred : 10;
  const counts = allowedCounts.map((count) => ({ count, available: count <= publishedCount }));
  const defaultCount = chooseQuizCount(counts.filter((option) => option.available).map((option) => option.count), preferredCount);
  const defaultFeedbackMode = quizFeedbackSetting(values.get("quiz_default_subject_feedback"), "exam");
  const smartPracticeEnabled = values.get("quiz_smart_practice_enabled") !== false;

  return NextResponse.json({
    subject,
    publishedCount,
    topicCount: subject._count.topics,
    allowedCounts: counts,
    defaultCount,
    defaultFeedbackMode,
    smartPracticeEnabled,
  });
}
