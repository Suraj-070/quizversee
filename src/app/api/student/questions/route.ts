import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { normalizeQuizCounts, chooseQuizCount, parseStoredSetting, quizFeedbackSetting } from "@/lib/quiz-preferences";

/**
 * GET /api/student/questions?topicId=<id>
 *
 * Returns the published-question count for a topic plus the
 * allowed quiz counts (from the `quiz_question_counts` Setting).
 *
 * Used by the QuizSetup screen to render the count picker with
 * availability logic per PRD §14:
 *   - Allowed counts come from settings (e.g. [10,20,30,40,50])
 *   - Counts greater than the available published-question count
 *     are returned but flagged as `available: false`
 *
 * This endpoint does NOT return the actual questions — those are
 * fetched (and randomized) when the student starts a quiz via
 * /api/student/attempts (POST).
 */
export async function GET(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const url = new URL(request.url);
  const topicId = url.searchParams.get("topicId");
  if (!topicId) {
    return NextResponse.json(
      { error: "topicId is required" },
      { status: 400 }
    );
  }

  // Verify topic is active (so students can't quiz on disabled topics)
  const topic = await db.topic.findFirst({
    where: { id: topicId, isActive: true },
    select: {
      id: true,
      contentType: true,
      name: true,
      description: true,
      subject: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!topic) {
    return NextResponse.json(
      { error: "Topic not found or not available" },
      { status: 404 }
    );
  }

  const publishedCount = await db.question.count({
    where: { topicId, status: "published", archivedAt: null, contentType: topic.contentType },
  });

  // A one-question quick practice is always available, even on a new or
  // small topic. Admin settings control the additional selectable counts.
  const settings = await db.setting.findMany({
    where: { key: { in: ["quiz_question_counts", "quiz_default_count", "quiz_default_topic_feedback", "quiz_smart_practice_enabled"] } },
  });
  const values = new Map(settings.map((setting) => [setting.key, parseStoredSetting(setting.value)]));
  const allowedCounts = normalizeQuizCounts(values.get("quiz_question_counts"));
  const preferred = values.get("quiz_default_count");
  const preferredCount = typeof preferred === "number" && allowedCounts.includes(preferred) ? preferred : 10;
  const counts = allowedCounts.map((count) => ({ count, available: count <= publishedCount }));
  const defaultCount = chooseQuizCount(counts.filter((option) => option.available).map((option) => option.count), preferredCount);
  const defaultFeedbackMode = quizFeedbackSetting(values.get("quiz_default_topic_feedback"), "immediate");
  const smartPracticeEnabled = values.get("quiz_smart_practice_enabled") !== false;

  return NextResponse.json({
    topic,
    publishedCount,
    allowedCounts: counts,
    defaultCount,
    defaultFeedbackMode,
    smartPracticeEnabled,
  });
}
