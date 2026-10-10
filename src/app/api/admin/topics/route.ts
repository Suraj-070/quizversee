import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { nextDisplayOrder } from "@/lib/prisma-queries";

/**
 * GET /api/admin/topics?subjectId=<optional>&classId=<optional>
 * Returns topics, optionally filtered by subject or class. Includes parent
 * subject + class names for display in the admin table.
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId");
  const classId = url.searchParams.get("classId");

  const where: { subjectId?: string; subject?: { classId?: string } } = {};
  if (subjectId) where.subjectId = subjectId;
  if (classId) where.subject = { classId };

  const topics = await db.topic.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
      _count: { select: { questions: true } },
    },
  });

  return NextResponse.json({ topics });
}

const CreateTopicSchema = z.object({
  subjectId: z.string().min(1, "Subject is required"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.number().int().optional(),
});

/**
 * POST /api/admin/topics
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = CreateTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { subjectId, name, description, isActive, displayOrder } = parsed.data;

  // Verify the parent subject exists
  const subject = await db.subject.findUnique({
    where: { id: subjectId },
    select: { id: true },
  });
  if (!subject) {
    return NextResponse.json(
      { error: "Selected subject does not exist" },
      { status: 400 }
    );
  }

  // Uniqueness within the subject
  const existing = await db.topic.findFirst({
    where: { subjectId, name: name.trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A topic with this name already exists in this subject" },
      { status: 409 }
    );
  }

  const order =
    displayOrder ?? (await nextDisplayOrder({ model: "topic", subjectId }));

  const topic = await db.topic.create({
    data: {
      subjectId,
      name: name.trim(),
      description: description?.trim() || null,
      isActive,
      displayOrder: order,
    },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          class: { select: { id: true, name: true } },
        },
      },
      _count: { select: { questions: true } },
    },
  });

  return NextResponse.json({ topic }, { status: 201 });
}
