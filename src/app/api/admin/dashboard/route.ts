import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/dashboard
 *
 * Returns aggregate counts for the admin dashboard summary cards.
 * Requires admin role.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [
    classes,
    subjects,
    topics,
    questions,
    publishedQuestions,
    users,
    quizAttempts,
  ] = await Promise.all([
    db.class.count(),
    db.subject.count(),
    db.topic.count(),
    db.question.count(),
    db.question.count({ where: { status: "published" } }),
    db.user.count(),
    db.quizAttempt.count(),
  ]);

  return NextResponse.json({
    classes,
    subjects,
    topics,
    questions,
    publishedQuestions,
    users,
    quizAttempts,
  });
}
