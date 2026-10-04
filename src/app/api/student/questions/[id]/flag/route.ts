import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * POST /api/student/questions/[id]/flag
 * Toggles a flag on a question for the current user.
 * If the flag exists, it's removed; if it doesn't, it's created.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id: questionId } = await params;

  const existing = await db.questionFlag.findUnique({
    where: { userId_questionId: { userId: user.id, questionId } },
  });

  if (existing) {
    await db.questionFlag.delete({ where: { id: existing.id } });
    return NextResponse.json({ flagged: false });
  } else {
    await db.questionFlag.create({
      data: { userId: user.id, questionId },
    });
    return NextResponse.json({ flagged: true });
  }
}

/**
 * GET /api/student/questions/[id]/flag
 * Returns whether the current user has flagged this question.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;

  const { id: questionId } = await params;
  const flag = await db.questionFlag.findUnique({
    where: { userId_questionId: { userId: user.id, questionId } },
  });

  return NextResponse.json({ flagged: !!flag });
}
