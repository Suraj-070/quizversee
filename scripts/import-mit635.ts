/**
 * Import MIT635 Data Wrangling & Visualisation question bank.
 *
 * Creates:
 *   Class: "University / Higher Education"
 *   Subject: "MIT635 Data Wrangling & Visualisation"
 *   12 Topics (Week 1-11 + Data Visualisation Scenarios)
 *   61 Questions (curriculum, published)
 *
 * Handles 4 chart images by converting them to base64 data URIs.
 * Idempotent: won't duplicate on re-run.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname, resolve } from "path";

const db = new PrismaClient();

async function findOrCreateClass(name: string) {
  const existing = await db.class.findFirst({ where: { name } });
  if (existing) return existing;
  return db.class.create({ data: { name, isActive: true, displayOrder: 10 } });
}

async function findOrCreateSubject(classId: string, name: string) {
  const existing = await db.subject.findFirst({ where: { classId, name } });
  if (existing) return existing;
  return db.subject.create({ data: { classId, name, isActive: true, displayOrder: 10 } });
}

async function findOrCreateTopic(subjectId: string, name: string) {
  const existing = await db.topic.findFirst({ where: { subjectId, name } });
  if (existing) return existing;
  return db.topic.create({ data: { subjectId, name, isActive: true, displayOrder: 10, contentType: "curriculum" } });
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function getOptionText(q: { options: Record<string, { text: string; image: string | null }> }, key: string): string {
  return q.options[key]?.text || "—";
}

function getOptionImage(q: { options: Record<string, { text: string; image: string | null }> }, key: string): string | null {
  return q.options[key]?.image || null;
}

/** Convert image file to base64 data URI */
function imageToDataUri(imagePath: string, baseDir: string): string | null {
  const fullPath = resolve(baseDir, imagePath);
  try {
    const buffer = readFileSync(fullPath);
    const ext = imagePath.toLowerCase().split(".").pop();
    const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    console.warn(`  ⚠️  Image not found: ${fullPath}`);
    return null;
  }
}

async function main() {
  const jsonPath = "/tmp/mit635/MIT635_Quizverse_Question_Bank.json";
  const baseDir = dirname(jsonPath);

  const raw = readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw) as {
    class: string;
    subject: string;
    courseCode: string;
    topics: Array<{
      topic: string;
      questions: Array<{
        id?: string;
        question: string;
        questionImage: string | null;
        options: Record<string, { text: string; image: string | null }>;
        answer: string;
        explanation: string | null;
        difficulty?: string;
      }>;
    }>;
  };

  // 1. Find or create Class
  const klass = await findOrCreateClass(data.class);
  console.log(`✅ Class: ${klass.name} (id=${klass.id})`);

  // 2. Find or create Subject
  const subject = await findOrCreateSubject(klass.id, data.subject);
  console.log(`✅ Subject: ${subject.name} (id=${subject.id})`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalImages = 0;
  const failures: Array<{ topic: string; index: number; reason: string }> = [];

  for (const topicData of data.topics) {
    const topicName = topicData.topic;
    console.log(`\n📋 ${topicName} (${topicData.questions.length} questions)`);

    const topic = await findOrCreateTopic(subject.id, topicName);
    console.log(`   Topic id: ${topic.id}`);

    // Get existing questions for duplicate check
    const existing = await db.question.findMany({
      where: { topicId: topic.id },
      select: { questionText: true },
    });
    const existingTexts = new Set(existing.map((q) => normalize(q.questionText)));

    for (let i = 0; i < topicData.questions.length; i++) {
      const q = topicData.questions[i];

      // Validation
      if (!q.question?.trim()) {
        totalFailed++;
        failures.push({ topic: topicName, index: i + 1, reason: "Empty question text" });
        continue;
      }
      if (!q.options || Object.keys(q.options).length < 2) {
        totalFailed++;
        failures.push({ topic: topicName, index: i + 1, reason: "Need at least 2 options" });
        continue;
      }
      if (!q.answer || !["A", "B", "C", "D"].includes(q.answer)) {
        totalFailed++;
        failures.push({ topic: topicName, index: i + 1, reason: `Invalid answer: ${q.answer}` });
        continue;
      }
      if (!q.options[q.answer]?.text) {
        totalFailed++;
        failures.push({ topic: topicName, index: i + 1, reason: `Answer ${q.answer} has no corresponding option` });
        continue;
      }

      // Duplicate check
      const norm = normalize(q.question);
      if (existingTexts.has(norm)) {
        totalSkipped++;
        continue;
      }

      // Convert image to data URI if present
      let questionImage = null;
      if (q.questionImage) {
        questionImage = imageToDataUri(q.questionImage, baseDir);
        if (questionImage) totalImages++;
      }

      // Insert — IGNORE difficulty field per spec
      try {
        await db.question.create({
          data: {
            topicId: topic.id,
            questionText: q.question.trim(),
            optionA: getOptionText(q, "A"),
            optionB: getOptionText(q, "B"),
            optionC: getOptionText(q, "C"),
            optionD: getOptionText(q, "D"),
            correctOption: q.answer,
            explanation: q.explanation?.trim() || null,
            status: "published",
            contentType: "curriculum",
            questionImage,
            optionAImage: getOptionImage(q, "A"),
            optionBImage: getOptionImage(q, "B"),
            optionCImage: getOptionImage(q, "C"),
            optionDImage: getOptionImage(q, "D"),
          },
        });
        existingTexts.add(norm);
        totalImported++;
      } catch (err) {
        totalFailed++;
        failures.push({ topic: topicName, index: i + 1, reason: `DB error: ${(err as Error).message}` });
      }
    }

    const finalCount = await db.question.count({
      where: { topicId: topic.id, status: "published", archivedAt: null },
    });
    console.log(`   ✅ ${topicName}: ${finalCount} questions in database`);
  }

  // Final report
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 MIT635 IMPORT COMPLETE`);
  console.log(`   Class: ${data.class}`);
  console.log(`   Subject: ${data.subject}`);
  console.log(`   Provided: 61`);
  console.log(`   Newly imported: ${totalImported}`);
  console.log(`   Already existed (skipped): ${totalSkipped}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Images embedded: ${totalImages}`);

  if (failures.length > 0) {
    console.log(`\n   Failures:`);
    for (const f of failures) {
      console.log(`   ${f.topic} Q${f.index}: ${f.reason}`);
    }
  }

  console.log(`\n   Final database verification:`);
  const topics = await db.topic.findMany({
    where: { subjectId: subject.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  for (const t of topics) {
    const count = await db.question.count({
      where: { topicId: t.id, status: "published", archivedAt: null },
    });
    console.log(`   ${t.name}: ${count} questions`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
}).finally(() => db.$disconnect());
