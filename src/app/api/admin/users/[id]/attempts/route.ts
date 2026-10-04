import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/users/[id]/attempts
 *
 * Returns the full quiz attempt history for a specific student.
 * Used by the admin "user detail" screen to track student progress.
 */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const attempts = await db.quizAttempt.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      topic: {
        select: {
          id: true,
          name: true,
          subject: {
            select: {
              id: true,
              name: true,
              class: { select: { id: true, name: true } },
            },
          },
        },
      },
      subject: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
      quizSet: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ user, attempts });
}
