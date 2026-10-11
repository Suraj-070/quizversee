import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { normalizeQuizCounts } from "@/lib/quiz-preferences";

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
    .array(z.number().int().min(1).max(100)).min(1).max(20)
    .optional(),
  quiz_default_count: z.number().int().min(1).max(100).optional(),
  quiz_default_topic_feedback: z.enum(["immediate", "exam"]).optional(),
  quiz_default_subject_feedback: z.enum(["immediate", "exam"]).optional(),
  quiz_smart_practice_enabled: z.boolean().optional(),
  site_homepage_heading: z.string().max(200).optional(),
  site_homepage_subtitle: z.string().max(500).optional(),
  site_footer_text: z.string().max(200).optional(),
  site_contact_email: z.string().max(200).optional(),
});

/**
 * PUT /api/admin/settings
 * Updates settings. Supports quiz_question_counts + site content keys.
 */
export async function PUT(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Update each setting key that was provided
  const updates: Array<[string, string]> = [];
  if (parsed.data.quiz_question_counts) {
    updates.push(["quiz_question_counts", JSON.stringify(normalizeQuizCounts(parsed.data.quiz_question_counts))]);
  }
  if (parsed.data.quiz_default_count !== undefined) {
    const submittedCounts = parsed.data.quiz_question_counts;
    if (submittedCounts && !normalizeQuizCounts(submittedCounts).includes(parsed.data.quiz_default_count)) {
      return NextResponse.json({ error: "Default count must be an enabled question count" }, { status: 400 });
    }
    updates.push(["quiz_default_count", JSON.stringify(parsed.data.quiz_default_count)]);
  }
  for (const key of ["quiz_default_topic_feedback", "quiz_default_subject_feedback", "quiz_smart_practice_enabled"] as const) {
    const value = parsed.data[key];
    if (value !== undefined) updates.push([key, JSON.stringify(value)]);
  }
  if (parsed.data.site_homepage_heading !== undefined) {
    updates.push(["site_homepage_heading", JSON.stringify(parsed.data.site_homepage_heading)]);
  }
  if (parsed.data.site_homepage_subtitle !== undefined) {
    updates.push(["site_homepage_subtitle", JSON.stringify(parsed.data.site_homepage_subtitle)]);
  }
  if (parsed.data.site_footer_text !== undefined) {
    updates.push(["site_footer_text", JSON.stringify(parsed.data.site_footer_text)]);
  }
  if (parsed.data.site_contact_email !== undefined) {
    updates.push(["site_contact_email", JSON.stringify(parsed.data.site_contact_email)]);
  }

  for (const [key, value] of updates) {
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // Log settings change
  if (updates.length > 0) {
    try {
      const { logAdminActivity, ADMIN_ACTIONS } = await import("@/lib/admin-activity");
      await logAdminActivity(user.id, ADMIN_ACTIONS.SETTINGS_CHANGED, "Setting", null, "Updated site settings");
    } catch { /* ignore */ }
  }

  return NextResponse.json({ success: true });
}
