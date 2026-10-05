import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { logAdminActivity, ADMIN_ACTIONS } from "@/lib/admin-activity";

/**
 * GET /api/admin/announcements
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const announcements = await db.announcement.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { name: true } } },
  });

  return NextResponse.json({ announcements });
}

const CreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  message: z.string().min(1, "Message is required").max(2000),
  status: z.enum(["draft", "published"]).optional().default("draft"),
  publishDate: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
});

/**
 * POST /api/admin/announcements
 */
export async function POST(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { title, message, status, publishDate, expiryDate } = parsed.data;

  const announcement = await db.announcement.create({
    data: {
      title: title.trim(),
      message: message.trim(),
      status,
      publishDate: publishDate ? new Date(publishDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      adminId: user.id,
    },
  });

  if (status === "published") {
    await logAdminActivity(user.id, ADMIN_ACTIONS.ANNOUNCEMENT_PUBLISHED, "Announcement", announcement.id, `Published announcement: ${title}`);
  }

  return NextResponse.json({ announcement }, { status: 201 });
}
