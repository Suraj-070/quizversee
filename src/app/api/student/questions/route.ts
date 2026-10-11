import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { quizCountChoices } from "@/lib/qai-quiz-counts.mjs";

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
    where: { topicId, status: "published" },
  });

  // Fetch the allowed-counts setting (defaults to [10] if missing)
  const setting = await db.setting.findUnique({
    where: { key: "quiz_question_counts" },
  });
  let configuredCounts: unknown;
  try {
    configuredCounts = setting ? JSON.parse(setting.value) : undefined;
  } catch {
    configuredCounts = undefined;
  }
  const counts = quizCountChoices(configuredCounts, publishedCount);

  const defaultModeSetting = await db.setting.findUnique({ where: { key: "default_feedback_mode" } });
  const defaultFeedbackMode = defaultModeSetting?.value === '"exam"' ? "exam" : "immediate";

  return NextResponse.json({
    topic,
    publishedCount,
    defaultFeedbackMode,
    allowedCounts: counts,
  });
}
