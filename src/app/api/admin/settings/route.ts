import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/settings
 * Returns all settings as a key→value map.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const settings = await db.setting.findMany();
  const map: Record<string, unknown> = {};
  for (const s of settings) {
    try {
      map[s.key] = JSON.parse(s.value);
    } catch {
      map[s.key] = s.value;
    }
  }
  return NextResponse.json({ settings: map });
}

const UpdateSchema = z.object({
  quiz_question_counts: z
    .array(z.number().int().positive())
    .optional(),
});

/**
 * PUT /api/admin/settings
 * Updates settings. Currently only supports `quiz_question_counts`.
 */
export async function PUT(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  if (parsed.data.quiz_question_counts) {
    const value = JSON.stringify(parsed.data.quiz_question_counts);
    await db.setting.upsert({
      where: { key: "quiz_question_counts" },
      update: { value },
      create: { key: "quiz_question_counts", value },
    });
  }

  return NextResponse.json({ success: true });
}
