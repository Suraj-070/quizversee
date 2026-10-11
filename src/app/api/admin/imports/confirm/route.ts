import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";
import { logAdminActivity, ADMIN_ACTIONS } from "@/lib/admin-activity";

/**
 * POST /api/admin/imports/confirm
 *
 * Receives the base64-encoded JSON from the preview step + the admin's
 * confirmation. Parses, validates again (safety), finds-or-creates the
 * Class/Subject/Topic hierarchy, and inserts valid questions.
 *
 * Body:
 *   { rawJson: string (base64), filename: string, importAsDraft?: boolean }
 *
 * If importAsDraft=true (default true), questions are inserted with
 * status="draft" and an importBatchId stamp so they can be bulk-published
 * later from the Import Center.
 */
export async function POST(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body?.rawJson) {
    return NextResponse.json({ error: "Missing rawJson" }, { status: 400 });
  }

  // Always default to review first, including direct API calls.
  const importAsDraft = body.importAsDraft !== false;
  // Generate a stable batch identifier for this import run so admins can
  // later filter the Import Center by batch.
  const importBatchId = `json-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let raw: string;
  try {
    raw = Buffer.from(body.rawJson, "base64").toString("utf-8");
  } catch {
    return NextResponse.json({ error: "Invalid rawJson encoding" }, { status: 400 });
  }

  let data: {
    class: string;
    subject: string;
    topic: string;
    questions: Array<{
      question: string;
      questionImage: string | null;
      options: {
        A: { text: string; image: string | null };
        B: { text: string; image: string | null };
        C: { text: string; image: string | null };
        D: { text: string; image: string | null };
      };
      answer: string;
      explanation: string;
    }>;
  };

  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate before creating a class, subject or topic.
  if (typeof data?.class !== "string" || !data.class.trim() ||
      typeof data?.subject !== "string" || !data.subject.trim() ||
      typeof data?.topic !== "string" || !data.topic.trim() ||
      !Array.isArray(data.questions) || data.questions.length === 0 || data.questions.length > 300) {
    return NextResponse.json({ error: "Supply class, subject, topic and 1–300 questions" }, { status: 400 });
  }
  data.class = data.class.trim();
  data.subject = data.subject.trim();
  data.topic = data.topic.trim();

  // Find or create Class → Subject → Topic
  let klass = await db.class.findFirst({ where: { name: data.class, archivedAt: null } });
  if (!klass) {
    klass = await db.class.create({
      data: { name: data.class, isActive: true, displayOrder: 0 },
    });
  }

  let subject = await db.subject.findFirst({ where: { classId: klass.id, name: data.subject, archivedAt: null } });
  if (!subject) {
    subject = await db.subject.create({
      data: { classId: klass.id, name: data.subject, isActive: true, displayOrder: 0 },
    });
  }

  let topic = await db.topic.findFirst({ where: { subjectId: subject.id, name: data.topic, archivedAt: null } });
  if (!topic) {
    topic = await db.topic.create({
      data: { subjectId: subject.id, name: data.topic, isActive: true, displayOrder: 0 },
    });
  }

  // NEVER delete or replace existing questions: that could orphan exam attempts,
  // flags, mastery and student answers. Imports are append-only and idempotent
  // for the same topic/question text.
  if (topic.contentType !== "curriculum") {
    return NextResponse.json({ error: "This topic belongs to supplementary practice, not My Learning" }, { status: 409 });
  }
  const stored = await db.question.findMany({
    where: { topicId: topic.id, archivedAt: null },
    select: { questionText: true },
  });
  const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  const seen = new Set(stored.map((question) => normalize(question.questionText)));
  const totalBefore = stored.length;

  // Insert valid questions
  let imported = 0;
  let failed = 0;
  let skipped = 0;
  const failures: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];

    // Validate
    if (!q?.question?.trim() || !q.answer || !["A", "B", "C", "D"].includes(q.answer)) {
      failed++;
      failures.push({ index: i + 1, reason: "Missing question text or invalid answer" });
      continue;
    }
    if (!q.options?.A?.text || !q.options?.B?.text || !q.options?.C?.text || !q.options?.D?.text) {
      failed++;
      failures.push({ index: i + 1, reason: "Missing option text" });
      continue;
    }
    const key = normalize(q.question);
    if (seen.has(key)) {
      skipped++;
      continue;
    }

    try {
      await db.question.create({
        data: {
          topicId: topic.id,
          questionText: q.question.trim(),
          optionA: q.options.A.text,
          optionB: q.options.B.text,
          optionC: q.options.C.text,
          optionD: q.options.D.text,
          correctOption: q.answer,
          explanation: q.explanation?.trim() || null,
          contentType: "curriculum",
          // When importAsDraft is true, insert as draft so the admin can
          // review and bulk-publish from the Import Center. Otherwise
          // preserve the legacy behavior of publishing directly.
          status: importAsDraft ? "draft" : "published",
          questionImage: q.questionImage || null,
          optionAImage: q.options.A.image || null,
          optionBImage: q.options.B.image || null,
          optionCImage: q.options.C.image || null,
          optionDImage: q.options.D.image || null,
          // Tag with the batch ID for later filtering.
          importBatchId,
          sourceType: "manual",
          sourceName: body.filename || "json-import",
        },
      });
      imported++;
      seen.add(key);
    } catch (err) {
      failed++;
      failures.push({ index: i + 1, reason: "Database error during insert" });
    }
  }

  const totalAfter = await db.question.count({ where: { topicId: topic.id, archivedAt: null } });

  // Record import history
  const imagesCount = data.questions.filter((q) => q.questionImage).length;
  await db.importHistory.create({
    data: {
      filename: body.filename || "import.json",
      className: data.class,
      subjectName: data.subject,
      topicName: data.topic,
      imported,
      failed,
      skipped,
      imagesCount,
      adminId: user.id,
    },
  });

  // Log activity
  await logAdminActivity(
    user.id,
    ADMIN_ACTIONS.QUESTIONS_IMPORTED,
    "Question",
    topic.id,
    `Imported ${imported} ${data.topic} questions` +
      (importAsDraft ? " (as draft, batch=" + importBatchId + ")" : "")
  );

  return NextResponse.json({
    success: true,
    imported,
    failed,
    skipped,
    imagesCount,
    totalBefore,
    totalAfter,
    failures,
    topicName: data.topic,
    importBatchId,
    status: importAsDraft ? "draft" : "published",
  });
}

/**
 * GET /api/admin/imports
 * Returns import history.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const history = await db.importHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      admin: { select: { name: true } },
    },
  });

  return NextResponse.json({ history });
}
