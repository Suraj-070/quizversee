import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/questions/flagged
 *
 * Returns all questions the current user has flagged, with their
 * parent topic/subject/class chain for display.
 */
export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;

  const flags = await db.questionFlag.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      question: {
        select: {
          id: true,
          questionText: true,
          status: true,
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
        },
      },
    },
  });

  return NextResponse.json({ flags });
}
