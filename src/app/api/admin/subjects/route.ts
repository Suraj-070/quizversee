import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { nextDisplayOrder } from "@/lib/prisma-queries";

/**
 * GET /api/admin/subjects?classId=<optional>
 * Returns subjects, optionally filtered by class. Includes the parent
 * class name for display in the admin table.
 */
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");

  const subjects = await db.subject.findMany({
    where: classId ? { classId } : undefined,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      class: { select: { id: true, name: true } },
      _count: { select: { topics: true } },
    },
  });

  return NextResponse.json({ subjects });
}

const CreateSubjectSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(60).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.number().int().optional(),
});

/**
 * POST /api/admin/subjects
 * Creates a new subject under a class.
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = CreateSubjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { classId, name, description, icon, isActive, displayOrder } =
    parsed.data;

  // Verify the parent class exists
  const klass = await db.class.findUnique({ where: { id: classId } });
  if (!klass) {
    return NextResponse.json(
      { error: "Selected class does not exist" },
      { status: 400 }
    );
  }

  // Uniqueness within the class
  const existing = await db.subject.findFirst({
    where: { classId, name: name.trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A subject with this name already exists in this class" },
      { status: 409 }
    );
  }

  const order =
    displayOrder ?? (await nextDisplayOrder({ model: "subject", classId }));

  const subject = await db.subject.create({
    data: {
      classId,
      name: name.trim(),
      description: description?.trim() || null,
      icon: icon?.trim() || null,
      isActive,
      displayOrder: order,
    },
    include: {
      class: { select: { id: true, name: true } },
      _count: { select: { topics: true } },
    },
  });

  return NextResponse.json({ subject }, { status: 201 });
}
