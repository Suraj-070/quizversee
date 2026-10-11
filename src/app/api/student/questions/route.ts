import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

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

  // Fetch the allowed-counts setting (defaults to [10] if missing)
  const setting = await db.setting.findUnique({
    where: { key: "quiz_question_counts" },
  });
  let allowedCounts: number[] = [10];
  if (setting) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        allowedCounts = parsed
          .filter((n): n is number => typeof n === "number" && n > 0)
          .sort((a, b) => a - b);
      }
    } catch {
      // fall back to default
    }
  }

  // Build the availability map: each allowed count is "available" iff
  // it does not exceed the published-question count.
  const counts = allowedCounts.map((n) => ({
    count: n,
    available: n <= publishedCount,
  }));

  return NextResponse.json({
    topic,
    publishedCount,
    allowedCounts: counts,
  });
}
