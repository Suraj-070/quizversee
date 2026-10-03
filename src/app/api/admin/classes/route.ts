import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { nextDisplayOrder } from "@/lib/prisma-queries";

/**
 * GET /api/admin/classes
 * Returns all classes, ordered by displayOrder then name.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const classes = await db.class.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ classes });
}

const CreateClassSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.number().int().optional(),
});

/**
 * POST /api/admin/classes
 * Creates a new class.
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = CreateClassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, description, isActive, displayOrder } = parsed.data;

  const existing = await db.class.findFirst({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json(
      { error: "A class with this name already exists" },
      { status: 409 }
    );
  }

  const order =
    displayOrder ?? (await nextDisplayOrder({ model: "class" }));

  const klass = await db.class.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      isActive,
      displayOrder: order,
    },
  });

  return NextResponse.json({ class: klass }, { status: 201 });
}
