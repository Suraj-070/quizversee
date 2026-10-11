import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { quizCountChoices } from "@/lib/qai-quiz-counts.mjs";

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
    subject,
    publishedCount,
    defaultFeedbackMode,
    topicCount: subject._count.topics,
    allowedCounts: counts,
  });
}
