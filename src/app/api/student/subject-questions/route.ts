import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

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
      _count: { select: { topics: { where: { isActive: true } } } },
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
      topic: { subjectId, isActive: true },
    },
  });

  // Fetch the allowed-counts setting (defaults to [10] if missing)
  const setting = await db.setting.findUnique({
    where: { key: "quiz_question_counts" },
  });
  let allowedCounts: number[] = [1, 3, 5, 10];
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

  // Support one-question quizzes and small question banks automatically.
  allowedCounts = [...new Set([1, publishedCount, ...allowedCounts])]
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  // Build the availability map
  const counts = allowedCounts.map((n) => ({
    count: n,
    available: n <= publishedCount,
  }));

  return NextResponse.json({
    subject,
    publishedCount,
    topicCount: subject._count.topics,
    allowedCounts: counts,
  });
}
