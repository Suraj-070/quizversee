import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * POST /api/admin/imports/preview
 *
 * Accepts a multipart/form-data upload with a single `file` field (JSON).
 * Parses + validates WITHOUT inserting. Returns a preview.
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.name.endsWith(".json")) {
    return NextResponse.json({ error: "File must be a .json file" }, { status: 400 });
  }

  const raw = await file.text();
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
    return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
  }

  if (!data?.class || !data?.subject || !data?.topic || !Array.isArray(data.questions) || data.questions.length === 0 || data.questions.length > 300) {
    return NextResponse.json({
      error: "JSON must have 'class', 'subject', 'topic', and 1–300 questions",
    }, { status: 400 });
  }

  // Validate each question
  const results: Array<{ index: number; valid: boolean; warnings: string[]; errors: string[] }> = [];
  let validCount = 0, warningCount = 0, errorCount = 0, imagesCount = 0;

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i];
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!q.question?.trim()) errors.push("Missing question text");
    if (!q.options?.A?.text && !q.options?.A?.image) errors.push("Missing option A");
    if (!q.options?.B?.text && !q.options?.B?.image) errors.push("Missing option B");
    if (!q.options?.C?.text && !q.options?.C?.image) errors.push("Missing option C");
    if (!q.options?.D?.text && !q.options?.D?.image) errors.push("Missing option D");
    if (!q.answer || !["A", "B", "C", "D"].includes(q.answer)) errors.push("Invalid answer");
    if (!q.explanation?.trim()) warnings.push("Missing explanation");
    if (q.questionImage) imagesCount++;

    const valid = errors.length === 0;
    if (valid) validCount++;
    if (warnings.length > 0) warningCount++;
    if (errors.length > 0) errorCount++;

    results.push({ index: i, valid, warnings, errors });
  }

  return NextResponse.json({
    preview: {
      filename: file.name,
      className: data.class,
      subjectName: data.subject,
      topicName: data.topic,
      questionCount: data.questions.length,
      imagesCount,
      validation: { valid: validCount, warnings: warningCount, errors: errorCount },
      perQuestion: results,
      // Pass the raw JSON back (base64-encoded) so the confirm step can use it
      // without re-uploading the file.
      rawJson: Buffer.from(raw).toString("base64"),
    },
  });
}
