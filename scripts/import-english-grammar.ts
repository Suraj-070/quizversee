/**
 * Import Class 9 English Grammar questions into the existing Quizverse database.
 *
 * Handles questions with 2, 3, or 4 options by filling missing options
 * with a dash placeholder ("—").
 *
 * Idempotent: running twice won't duplicate questions.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const db = new PrismaClient();

async function findOrCreateClass(name: string) {
  const existing = await db.class.findFirst({ where: { name } });
  if (existing) return existing;
  return db.class.create({ data: { name, isActive: true, displayOrder: 1 } });
}

async function findOrCreateSubject(classId: string, name: string) {
  const existing = await db.subject.findFirst({ where: { classId, name } });
  if (existing) return existing;
  return db.subject.create({ data: { classId, name, isActive: true, displayOrder: 1 } });
}

async function findOrCreateTopic(subjectId: string, name: string) {
  const existing = await db.topic.findFirst({ where: { subjectId, name } });
  if (existing) return existing;
  return db.topic.create({ data: { subjectId, name, isActive: true, displayOrder: 1, contentType: "curriculum" } });
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

// Fill missing options with a dash placeholder
function getOptionText(q: { options: Record<string, { text: string; image: string | null }> }, key: string): string {
  const opt = q.options[key];
  return opt?.text || "—";
}

function getOptionImage(q: { options: Record<string, { text: string; image: string | null }> }, key: string): string | null {
  return q.options[key]?.image || null;
}

async function main() {
  const files = [
    "/tmp/eng_extract/modal_verbs.json",
    "/tmp/eng_extract/right_verbs_and_subjects.json",
    "/tmp/eng_extract/subject_verb_agreement.json",
  ];

  const klass = await findOrCreateClass("Class 9");
  console.log(`✅ Class: ${klass.name} (id=${klass.id})`);

  const subject = await findOrCreateSubject(klass.id, "English");
  console.log(`✅ Subject: ${subject.name} (id=${subject.id})`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const failures: Array<{ file: string; index: number; reason: string }> = [];

  for (const filePath of files) {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as {
      class: string;
      subject: string;
      topic: string;
      questions: Array<{
        id?: string;
        question: string;
        questionImage: string | null;
        options: Record<string, { text: string; image: string | null }>;
        answer: string;
        explanation: string | null;
      }>;
    };

    console.log(`\n📋 ${filePath.split("/").pop()}`);
    console.log(`   Topic: ${data.topic}, Questions: ${data.questions.length}`);

    const topic = await findOrCreateTopic(subject.id, data.topic);
    console.log(`   Topic: ${topic.name} (id=${topic.id})`);

    const existingQuestions = await db.question.findMany({
      where: { topicId: topic.id },
      select: { id: true, questionText: true },
    });
    const existingTexts = new Set(existingQuestions.map((q) => normalize(q.questionText)));

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];

      // Validation
      if (!q.question || !q.question.trim()) {
        totalFailed++;
        failures.push({ file: filePath, index: i + 1, reason: "Empty question text" });
        continue;
      }
      if (!q.options || Object.keys(q.options).length < 2) {
        totalFailed++;
        failures.push({ file: filePath, index: i + 1, reason: "Need at least 2 options" });
        continue;
      }
      if (!q.answer || !["A", "B", "C", "D"].includes(q.answer)) {
        totalFailed++;
        failures.push({ file: filePath, index: i + 1, reason: `Invalid answer: ${q.answer}` });
        continue;
      }
      // Check that the answer points to an existing option
      if (!q.options[q.answer]?.text) {
        totalFailed++;
        failures.push({ file: filePath, index: i + 1, reason: `Answer ${q.answer} has no corresponding option` });
        continue;
      }

      // Duplicate check
      const normalizedText = normalize(q.question);
      if (existingTexts.has(normalizedText)) {
        totalSkipped++;
        continue;
      }

      // Insert — fill missing options with "—"
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
            questionImage: q.questionImage || null,
            optionAImage: getOptionImage(q, "A"),
            optionBImage: getOptionImage(q, "B"),
            optionCImage: getOptionImage(q, "C"),
            optionDImage: getOptionImage(q, "D"),
          },
        });
        existingTexts.add(normalizedText);
        totalImported++;
      } catch (err) {
        totalFailed++;
        failures.push({ file: filePath, index: i + 1, reason: `DB error: ${(err as Error).message}` });
      }
    }

    const finalCount = await db.question.count({
      where: { topicId: topic.id, status: "published", archivedAt: null },
    });
    console.log(`   ✅ ${data.topic}: ${finalCount} total questions in database`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 IMPORT COMPLETE`);
  console.log(`   Class: Class 9`);
  console.log(`   Subject: English`);
  console.log(`   Provided: 102`);
  console.log(`   Newly imported: ${totalImported}`);
  console.log(`   Already existed (skipped): ${totalSkipped}`);
  console.log(`   Failed: ${totalFailed}`);

  if (failures.length > 0) {
    console.log(`\n   Failures:`);
    for (const f of failures) {
      console.log(`   Q${f.index} in ${f.file.split("/").pop()}: ${f.reason}`);
    }
  }

  console.log(`\n   Final database verification:`);
  const topics = await db.topic.findMany({
    where: { subjectId: subject.id },
    select: { id: true, name: true },
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
