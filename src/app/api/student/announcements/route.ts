import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/**
 * GET /api/student/announcements
 *
 * Returns active (published, not expired, not archived) announcements
 * for students to see on their dashboard.
 */
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const now = new Date();
  const announcements = await db.announcement.findMany({
    where: {
      status: "published",
      archivedAt: null,
      publishDate: { lte: now },
      OR: [
        { expiryDate: null },
        { expiryDate: { gt: now } },
      ],
    },
    orderBy: { publishDate: "desc" },
    select: {
      id: true,
      title: true,
      message: true,
      publishDate: true,
    },
  });

  return NextResponse.json({ announcements });
}
