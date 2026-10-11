import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/** Minimal server-backed session verification; never returns answer keys. */
export async function GET(request: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId) return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId: user.id },
    select: { completedAt: true },
  });
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  return NextResponse.json({ active: attempt.completedAt === null });
}
