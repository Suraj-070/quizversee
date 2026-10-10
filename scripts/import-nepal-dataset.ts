/**
 * Nepal Educational Dataset Pilot Import
 *
 * Fetches Q&A records from the Hugging Face dataset
 * dineshkarki/textbooks-qa-nepali, filters for Grades 9-12 + Science/Math/CS subjects,
 * converts suitable Q&A pairs into draft MCQs using the z-ai-web-dev-sdk LLM,
 * and imports them as EXTRA PRACTICE questions (contentType = "extra_practice").
 *
 * All generated MCQs are imported as status="draft" for admin review.
 *
 * Idempotent: won't duplicate on re-run (checks sourceQuestionId).
 */
import { PrismaClient } from "@prisma/client";
import ZAI from "z-ai-web-dev-sdk";
import { readFileSync, writeFileSync } from "fs";

const db = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────────
const DATASET = "dineshkarki/textbooks-qa-nepali";
const MAX_RECORDS_TO_FETCH = 200; // fetch ~200 relevant records
const MAX_MCQS_TO_GENERATE = 30; // generate up to 30 draft MCQs
const RELEVANT_SUBJECTS = new Set([
  "science", "Science_and_Technology", "Science_and_Environment",
  "math", "Math", "Optional_Maths", "optional_math",
  "computer_science", "environmental_science", "Civic_Science",
]);

// ── Helpers ──────────────────────────────────────────────────────────

async function findOrCreateClass(name: string) {
  const existing = await db.class.findFirst({ where: { name } });
  if (existing) return existing;
  return db.class.create({ data: { name, isActive: true, displayOrder: 20 } });
}

async function findOrCreateSubject(classId: string, name: string) {
  const existing = await db.subject.findFirst({ where: { classId, name } });
  if (existing) return existing;
  return db.subject.create({ data: { classId, name, isActive: true, displayOrder: 20 } });
}

async function findOrCreateTopic(subjectId: string, name: string) {
  const existing = await db.topic.findFirst({ where: { subjectId, name } });
  if (existing) return existing;
  return db.topic.create({
    data: { subjectId, name, isActive: true, displayOrder: 20, contentType: "extra_practice" },
  });
}

/** Map dataset subject to Quizverse subject name */
function mapSubject(dsSubject: string): string {
  const map: Record<string, string> = {
    "science": "Science",
    "Science_and_Technology": "Science & Technology",
    "Science_and_Environment": "Science & Environment",
    "math": "Mathematics",
    "Math": "Mathematics",
    "Optional_Maths": "Optional Mathematics",
    "optional_math": "Optional Mathematics",
    "computer_science": "Computer Science",
    "environmental_science": "Environmental Science",
    "Civic_Science": "Science",
  };
  return map[dsSubject] || dsSubject.replace(/_/g, " ");
}

/** Map grade number to class name */
function mapClass(grade: number): string {
  return `Class ${grade}`;
}

/** Fetch records from Hugging Face dataset */
async function fetchHFRecords(offset: number, length: number): Promise<any[]> {
  const url = `https://datasets-server.huggingface.co/rows?dataset=${DATASET}&config=default&split=train&offset=${offset}&length=${length}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HF API error: ${res.status}`);
  const data = await res.json();
  return (data.rows || []).map((r: any) => r.row);
}

/** Generate MCQ from Q&A using LLM */
async function generateMCQ(question: string, answer: string): Promise<{
  question: string; optionA: string; optionB: string; optionC: string; optionD: string;
  correctOption: string; explanation: string;
} | null> {
  try {
    const zai = await ZAI.create();
    const prompt = `Convert this Nepali educational Q&A into a multiple-choice question (MCQ) in English.
Return ONLY valid JSON with this exact structure:
{"question": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctOption": "A", "explanation": "..."}

Source Q (Nepali): ${question}
Source A (Nepali): ${answer}

Rules:
- Question must be in English
- 4 options, exactly one correct
- Incorrect options must be plausible but clearly wrong
- Keep explanation brief (1-2 sentences)
- correctOption must be A, B, C, or D`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "You are an educational MCQ generator. Output only valid JSON." },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const mcq = JSON.parse(jsonMatch[0]);
    // Validate
    if (!mcq.question || !mcq.optionA || !mcq.optionB || !mcq.optionC || !mcq.optionD) return null;
    if (!["A", "B", "C", "D"].includes(mcq.correctOption)) return null;
    return mcq;
  } catch (e) {
    console.error("  LLM error:", (e as Error).message?.substring(0, 100));
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Nepal Educational Dataset Pilot Import");
  console.log(`   Dataset: ${DATASET}`);
  console.log(`   Target: Grades 9-12, Science/Math/CS subjects`);
  console.log(`   Max MCQs to generate: ${MAX_MCQS_TO_GENERATE}`);
  console.log();

  // 1. Fetch records from Hugging Face
  console.log("📡 Fetching records from Hugging Face...");
  const relevantRecords: Array<{
    id: string; grade: number; subject: string; chapter: string;
    source: string; question: string; answer: string;
  }> = [];

  let offset = 0;
  while (offset < 2000 && relevantRecords.length < MAX_RECORDS_TO_FETCH) {
    try {
      const rows = await fetchHFRecords(offset, 100);
      if (rows.length === 0) break;

      for (const row of rows) {
        const grade = row.grade;
        const subject = row.subject;
        if (grade >= 9 && grade <= 12 && RELEVANT_SUBJECTS.has(subject)) {
          const convs = row.conversations || [];
          const human = convs.find((c: any) => c.from === "human");
          const gpt = convs.find((c: any) => c.from === "gpt");
          if (human?.value && gpt?.value) {
            relevantRecords.push({
              id: row.id,
              grade,
              subject,
              chapter: (row.chapter_title || "").substring(0, 100),
              source: row.source || "HF: textbooks-qa-nepali",
              question: human.value,
              answer: gpt.value,
            });
          }
        }
      }
      offset += 100;
    } catch (e) {
      console.log(`   ⚠️ Error at offset ${offset}: ${(e as Error).message}`);
      break;
    }
  }

  console.log(`   Fetched ${relevantRecords.length} relevant records (Grades 9-12, Science/Math/CS)`);

  // Stats
  const byGrade: Record<number, number> = {};
  const bySubject: Record<string, number> = {};
  for (const r of relevantRecords) {
    byGrade[r.grade] = (byGrade[r.grade] || 0) + 1;
    bySubject[r.subject] = (bySubject[r.subject] || 0) + 1;
  }
  console.log("   Grade distribution:", byGrade);
  console.log("   Subject distribution:", bySubject);

  // 2. Check for existing imports (idempotency)
  const existingImports = await db.question.count({
    where: { sourceType: "dataset", sourceName: "textbooks-qa-nepali" },
  });
  console.log(`   Already imported: ${existingImports} questions from this dataset`);

  if (existingImports >= MAX_MCQS_TO_GENERATE) {
    console.log("   ✅ Already have enough questions. Skipping.");
    await db.$disconnect();
    return;
  }

  // 3. Generate MCQs using LLM
  console.log(`\n🤖 Generating MCQs using LLM (max ${MAX_MCQS_TO_GENERATE})...`);
  let generated = 0;
  let failed = 0;
  let skipped = 0;
  const results: Array<any> = [];

  for (const record of relevantRecords) {
    if (generated >= MAX_MCQS_TO_GENERATE) break;

    // Check if already imported (by sourceQuestionId)
    const existing = await db.question.findFirst({
      where: { sourceQuestionId: record.id },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // Generate MCQ
    console.log(`   Generating MCQ ${generated + 1}/${MAX_MCQS_TO_GENERATE} (Grade ${record.grade}, ${record.subject})...`);
    const mcq = await generateMCQ(record.question, record.answer);
    if (!mcq) {
      failed++;
      continue;
    }

    // 4. Find or create class → subject → topic
    const className = mapClass(record.grade);
    const subjectName = mapSubject(record.subject);
    const topicName = record.chapter || `Extra Practice - ${subjectName}`;

    const klass = await findOrCreateClass(className);
    const subject = await findOrCreateSubject(klass.id, subjectName);
    const topic = await findOrCreateTopic(subject.id, topicName);

    // 5. Insert as DRAFT (extra_practice)
    try {
      await db.question.create({
        data: {
          topicId: topic.id,
          questionText: mcq.question,
          optionA: mcq.optionA,
          optionB: mcq.optionB,
          optionC: mcq.optionC,
          optionD: mcq.optionD,
          correctOption: mcq.correctOption,
          explanation: mcq.explanation || null,
          status: "draft", // Draft — needs admin review before publishing
          contentType: "extra_practice",
          sourceType: "dataset",
          sourceName: "textbooks-qa-nepali",
          sourceQuestionId: record.id,
          sourceLicense: "Apache-2.0",
          suitableLevels: JSON.stringify([className]),
        },
      });
      generated++;
      results.push({
        sourceId: record.id,
        grade: record.grade,
        subject: record.subject,
        chapter: topicName,
        question: mcq.question.substring(0, 80),
        correctOption: mcq.correctOption,
        status: "draft",
      });
    } catch (e) {
      console.log(`   ⚠️ DB error: ${(e as Error).message?.substring(0, 100)}`);
      failed++;
    }
  }

  // 6. Final report
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 NEPAL DATASET PILOT IMPORT COMPLETE`);
  console.log(`   Source records inspected: ${relevantRecords.length}`);
  console.log(`   Records matching Grades 9-12 + Science/Math/CS: ${relevantRecords.length}`);
  console.log(`   MCQs generated (draft): ${generated}`);
  console.log(`   Already existed (skipped): ${skipped}`);
  console.log(`   Generation failures: ${failed}`);
  console.log(`   All questions imported as: DRAFT (needs admin review)`);
  console.log(`   Content type: extra_practice (Extra Practice library)`);
  console.log(`   Source: textbooks-qa-nepali (Hugging Face)`);
  console.log(`   License: Apache-2.0`);

  // Save results for verification
  writeFileSync("/tmp/mit635_pilot_results.json", JSON.stringify(results, null, 2));

  // Verify database
  console.log(`\n   Database verification:`);
  const draftCount = await db.question.count({
    where: { sourceType: "dataset", sourceName: "textbooks-qa-nepali", status: "draft" },
  });
  console.log(`   Draft questions in DB: ${draftCount}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
}).finally(() => db.$disconnect());
