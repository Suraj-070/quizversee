/**
 * Nepal Educational Dataset Importer v2 — Large-batch edition.
 *
 * Improvements over the pilot importer:
 *   - Configurable max source records (default 500, supports 2000+).
 *   - Pagination through the HF dataset API with bounded retry + backoff.
 *   - Resume-after-interruption: tracks progress in a state file so
 *     re-running skips already-processed records.
 *   - Import batch identifier (importBatchId) stamped on every inserted
 *     question so admins can filter/publish them as a group.
 *   - Duplicate detection via sourceQuestionId (idempotent re-runs).
 *   - All generated MCQs are imported as status="draft" for admin review.
 *   - No fake data generation — only real LLM-converted MCQs are inserted.
 *
 * Usage:
 *   bun run scripts/import-nepal-dataset-v2.ts [maxRecords] [maxMcqs]
 *
 * Defaults:
 *   maxRecords = 500   (Stage 1 target per TASK E)
 *   maxMcqs    = 500   (1:1 — every fetched record attempts MCQ generation)
 *
 * Environment:
 *   Reads DATABASE_URL from .env (same as the running app).
 *   Uses z-ai-web-dev-sdk for LLM conversion (same as v1).
 *
 * State files (under /home/z/my-project/scripts/.nepal-import-state/):
 *   - progress.json: { importBatchId, lastOffset, processedSourceIds[] }
 *   - run-<timestamp>.log: human-readable run log
 *
 * HF API:
 *   https://datasets-server.huggingface.co/rows?dataset=<DATASET>&config=default&split=train&offset=<N>&length=<M>
 *   Rate limits: HF doesn't document a strict limit; we use 1 req/200ms
 *   pacing and exponential backoff (200ms → 400ms → 800ms → ... → 5s cap)
 *   on 429/5xx responses.
 */
import { PrismaClient } from "@prisma/client";
import ZAI from "z-ai-web-dev-sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const db = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────────
const DATASET = "dineshkarki/textbooks-qa-nepali";
const MAX_RECORDS_TO_FETCH = parseInt(process.argv[2] ?? "500", 10);
const MAX_MCQS_TO_GENERATE = parseInt(process.argv[3] ?? "500", 10);
const HF_PAGE_SIZE = 100;            // records per HF API call
const HF_MAX_OFFSET = 10000;         // safety cap to avoid infinite loops
const HF_REQ_DELAY_MS = 200;         // pacing between HF API calls
const HF_MAX_RETRIES = 4;            // per-request retry count
const HF_BACKOFF_BASE_MS = 200;
const HF_BACKOFF_CAP_MS = 5000;
const LLM_MAX_RETRIES = 2;
const DB_CHUNK_SIZE = 50;            // commit DB transactions in chunks

const RELEVANT_SUBJECTS = new Set([
  "science", "Science_and_Technology", "Science_and_Environment",
  "math", "Math", "Optional_Maths", "optional_math",
  "computer_science", "environmental_science", "Civic_Science",
]);

const STATE_DIR = "/home/z/my-project/scripts/.nepal-import-state";
const STATE_FILE = path.join(STATE_DIR, "progress.json");

// ── Helpers ──────────────────────────────────────────────────────────

async function findOrCreateClass(name: string) {
  const existing = await db.class.findFirst({ where: { name } });
  if (existing) return existing;
  return db.class.create({ data: { name, isActive: true, displayOrder: 20 } });
}

async function findOrCreateSubject(classId: string, name: string) {
  const existing = await db.subject.findFirst({ where: { classId, name } });
  if (existing) return existing;
  return db.subject.create({
    data: { classId, name, isActive: true, displayOrder: 20 },
  });
}

async function findOrCreateTopic(subjectId: string, name: string) {
  const existing = await db.topic.findFirst({ where: { subjectId, name } });
  if (existing) return existing;
  return db.topic.create({
    data: {
      subjectId, name, isActive: true, displayOrder: 20,
      contentType: "extra_practice",
    },
  });
}

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

function mapClass(grade: number): string {
  return `Class ${grade}`;
}

/** Sleep helper for pacing + backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch records from HF with retry + exponential backoff. */
async function fetchHFRecords(offset: number, length: number): Promise<any[]> {
  const url = `https://datasets-server.huggingface.co/rows?dataset=${DATASET}&config=default&split=train&offset=${offset}&length=${length}`;

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < HF_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        // Transient — back off and retry.
        const backoff = Math.min(
          HF_BACKOFF_CAP_MS,
          HF_BACKOFF_BASE_MS * Math.pow(2, attempt)
        );
        console.log(
          `   ⚠️ HF API returned ${res.status} at offset ${offset} (attempt ${attempt + 1}/${HF_MAX_RETRIES}). Backing off ${backoff}ms…`
        );
        await sleep(backoff);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HF API ${res.status}: ${await res.text().catch(() => "")}`);
      }
      const data = await res.json();
      return (data.rows || []).map((r: any) => r.row);
    } catch (err) {
      lastErr = err as Error;
      const backoff = Math.min(
        HF_BACKOFF_CAP_MS,
        HF_BACKOFF_BASE_MS * Math.pow(2, attempt)
      );
      console.log(
        `   ⚠️ HF fetch error at offset ${offset} (attempt ${attempt + 1}/${HF_MAX_RETRIES}): ${(err as Error).message}. Backing off ${backoff}ms…`
      );
      await sleep(backoff);
    }
  }
  throw lastErr ?? new Error("HF API failed after max retries");
}

/** Generate MCQ from Q&A using LLM with retry. */
async function generateMCQ(
  question: string,
  answer: string
): Promise<{
  question: string; optionA: string; optionB: string; optionC: string; optionD: string;
  correctOption: string; explanation: string;
} | null> {
  for (let attempt = 0; attempt < LLM_MAX_RETRIES; attempt++) {
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
      if (!jsonMatch) {
        if (attempt === LLM_MAX_RETRIES - 1) return null;
        continue;
      }

      const mcq = JSON.parse(jsonMatch[0]);
      if (!mcq.question || !mcq.optionA || !mcq.optionB || !mcq.optionC || !mcq.optionD) {
        if (attempt === LLM_MAX_RETRIES - 1) return null;
        continue;
      }
      if (!["A", "B", "C", "D"].includes(mcq.correctOption)) {
        if (attempt === LLM_MAX_RETRIES - 1) return null;
        continue;
      }
      return mcq;
    } catch (e) {
      if (attempt === LLM_MAX_RETRIES - 1) {
        console.error("  LLM error:", (e as Error).message?.substring(0, 100));
        return null;
      }
      await sleep(500);
    }
  }
  return null;
}

// ── Resume / state file ───────────────────────────────────────────────

type State = {
  importBatchId: string;
  lastOffset: number;
  processedSourceIds: string[];
  generated: number;
  failed: number;
  skipped: number;
};

function loadOrCreateState(): State {
  mkdirSync(STATE_DIR, { recursive: true });
  if (existsSync(STATE_FILE)) {
    try {
      const s = JSON.parse(readFileSync(STATE_FILE, "utf-8")) as State;
      console.log(`📂 Resuming from previous run (batch=${s.importBatchId}, lastOffset=${s.lastOffset}, alreadyProcessed=${s.processedSourceIds.length})`);
      return s;
    } catch {
      console.log("📂 State file unreadable — starting fresh.");
    }
  }
  const newBatch = `nepal-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
  return {
    importBatchId: newBatch,
    lastOffset: 0,
    processedSourceIds: [],
    generated: 0,
    failed: 0,
    skipped: 0,
  };
}

function saveState(s: State) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function clearState() {
  if (existsSync(STATE_FILE)) {
    writeFileSync(STATE_FILE + ".bak", readFileSync(STATE_FILE, "utf-8"));
    writeFileSync(STATE_FILE, "");
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Nepal Educational Dataset Import v2");
  console.log(`   Dataset: ${DATASET}`);
  console.log(`   Target: Grades 9-12, Science/Math/CS subjects`);
  console.log(`   Max source records: ${MAX_RECORDS_TO_FETCH}`);
  console.log(`   Max MCQs to generate: ${MAX_MCQS_TO_GENERATE}`);
  console.log();

  const state = loadOrCreateState();
  const processedSet = new Set(state.processedSourceIds);
  console.log(`   Import batch ID: ${state.importBatchId}`);
  console.log(`   Already processed: ${state.processedSourceIds.length} source records`);
  console.log();

  // Pre-fetch already-imported source IDs from DB (defensive — the state
  // file may have been lost).
  const alreadyInDb = await db.question.findMany({
    where: { sourceType: "dataset", sourceName: "textbooks-qa-nepali" },
    select: { sourceQuestionId: true },
  });
  for (const q of alreadyInDb) {
    if (q.sourceQuestionId) processedSet.add(q.sourceQuestionId);
  }
  console.log(`   Already in DB: ${alreadyInDb.length} questions from this dataset`);
  console.log();

  // Pre-fetch existing ImportHistory count for this dataset (informational).
  const existingImported = await db.question.count({
    where: { sourceType: "dataset", sourceName: "textbooks-qa-nepali" },
  });
  console.log(`   Total existing dataset questions in DB: ${existingImported}`);
  console.log();

  // 1. Fetch records from HF, paging until we hit maxRecords or run out.
  console.log("📡 Fetching records from Hugging Face…");
  const relevantRecords: Array<{
    id: string; grade: number; subject: string; chapter: string;
    source: string; question: string; answer: string;
  }> = [];

  let offset = state.lastOffset;
  let fetchErrors = 0;
  while (
    offset < HF_MAX_OFFSET &&
    relevantRecords.length < MAX_RECORDS_TO_FETCH
  ) {
    try {
      const rows = await fetchHFRecords(offset, HF_PAGE_SIZE);
      if (rows.length === 0) {
        console.log(`   Reached end of dataset at offset ${offset}.`);
        break;
      }

      let added = 0;
      for (const row of rows) {
        const grade = row.grade;
        const subject = row.subject;
        if (grade >= 9 && grade <= 12 && RELEVANT_SUBJECTS.has(subject)) {
          const convs = row.conversations || [];
          const human = convs.find((c: any) => c.from === "human");
          const gpt = convs.find((c: any) => c.from === "gpt");
          if (human?.value && gpt?.value && !processedSet.has(row.id)) {
            relevantRecords.push({
              id: row.id,
              grade,
              subject,
              chapter: (row.chapter_title || "").substring(0, 100),
              source: row.source || "HF: textbooks-qa-nepali",
              question: human.value,
              answer: gpt.value,
            });
            added++;
          }
        }
      }
      offset += HF_PAGE_SIZE;
      state.lastOffset = offset;
      saveState(state);

      console.log(
        `   Fetched ${rows.length} records at offset ${offset - HF_PAGE_SIZE} (${added} new relevant, ${relevantRecords.length}/${MAX_RECORDS_TO_FETCH})`
      );

      // Pacing between HF API calls.
      await sleep(HF_REQ_DELAY_MS);
    } catch (e) {
      fetchErrors++;
      console.log(
        `   ⚠️ Error at offset ${offset}: ${(e as Error).message} (fetchErrors=${fetchErrors})`
      );
      // If we get 5 consecutive fetch errors, abort — likely an HF outage.
      if (fetchErrors >= 5) {
        console.log("   ❌ Too many fetch errors. Aborting fetch phase.");
        break;
      }
      await sleep(2000);
    }
  }

  console.log(`\n   Fetched ${relevantRecords.length} relevant records total.`);
  console.log();

  if (relevantRecords.length === 0) {
    console.log("   No new records to process. Exiting.");
    await db.$disconnect();
    return;
  }

  // Stats
  const byGrade: Record<number, number> = {};
  const bySubject: Record<string, number> = {};
  for (const r of relevantRecords) {
    byGrade[r.grade] = (byGrade[r.grade] || 0) + 1;
    bySubject[r.subject] = (bySubject[r.subject] || 0) + 1;
  }
  console.log("   Grade distribution:", byGrade);
  console.log("   Subject distribution:", bySubject);
  console.log();

  // 2. Generate MCQs using LLM and insert into DB.
  console.log(`🤖 Generating MCQs using LLM (max ${MAX_MCQS_TO_GENERATE})…`);
  console.log(`   Each generated MCQ is inserted as DRAFT with batch=${state.importBatchId}`);
  console.log();

  const results: Array<any> = [];
  let generated = state.generated;
  let failed = state.failed;
  let skipped = state.skipped;

  for (let i = 0; i < relevantRecords.length; i++) {
    if (generated >= MAX_MCQS_TO_GENERATE) {
      console.log(`   Reached MAX_MCQS_TO_GENERATE limit (${MAX_MCQS_TO_GENERATE}).`);
      break;
    }

    const record = relevantRecords[i];
    console.log(
      `   [${i + 1}/${relevantRecords.length}] Grade ${record.grade} ${record.subject} (${record.id.slice(0, 8)})…`
    );

    // Defensive: skip if already processed (shouldn't happen due to filtering above).
    if (processedSet.has(record.id)) {
      skipped++;
      state.skipped = skipped;
      saveState(state);
      continue;
    }

    // Generate MCQ via LLM
    const mcq = await generateMCQ(record.question, record.answer);
    if (!mcq) {
      failed++;
      state.failed = failed;
      state.processedSourceIds.push(record.id);
      processedSet.add(record.id);
      saveState(state);
      console.log(`      ❌ LLM failed to produce valid MCQ`);
      continue;
    }

    // Find or create class → subject → topic
    const className = mapClass(record.grade);
    const subjectName = mapSubject(record.subject);
    const topicName = record.chapter || `Extra Practice - ${subjectName}`;

    try {
      const klass = await findOrCreateClass(className);
      const subject = await findOrCreateSubject(klass.id, subjectName);
      const topic = await findOrCreateTopic(subject.id, topicName);

      // Insert as DRAFT (extra_practice)
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
          importBatchId: state.importBatchId,
        },
      });
      generated++;
      state.generated = generated;
      state.processedSourceIds.push(record.id);
      processedSet.add(record.id);
      saveState(state);

      results.push({
        sourceId: record.id,
        grade: record.grade,
        subject: record.subject,
        chapter: topicName,
        question: mcq.question.substring(0, 80),
        correctOption: mcq.correctOption,
        status: "draft",
      });

      console.log(`      ✅ Generated MCQ (correctOption=${mcq.correctOption})`);
    } catch (e) {
      failed++;
      state.failed = failed;
      state.processedSourceIds.push(record.id);
      processedSet.add(record.id);
      saveState(state);
      console.log(`      ❌ DB error: ${(e as Error).message?.substring(0, 100)}`);
    }
  }

  // 3. Record in ImportHistory so the Import Center picks it up.
  // The pilot script didn't write to ImportHistory; this v2 does so the
  // batch shows up in the admin UI.
  try {
    // Note: ImportHistory.filename max length — keep it short.
    await db.importHistory.create({
      data: {
        filename: `nepal-${state.importBatchId.slice(0, 30)}.json`,
        className: "Multiple (Grades 9-12)",
        subjectName: "Multiple (Science/Math/CS)",
        topicName: "Extra Practice (various)",
        imported: generated - (state.generated - generated),
        failed,
        skipped,
        imagesCount: 0,
        adminId: null,
      },
    });
  } catch (e) {
    console.log(`   ⚠️ Failed to record ImportHistory: ${(e as Error).message}`);
  }

  // 4. Final report
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 NEPAL DATASET IMPORT v2 — COMPLETE`);
  console.log(`   Import batch ID: ${state.importBatchId}`);
  console.log(`   Source records inspected: ${relevantRecords.length}`);
  console.log(`   MCQs generated (draft): ${generated}`);
  console.log(`   Already existed (skipped): ${skipped}`);
  console.log(`   Generation failures: ${failed}`);
  console.log(`   All questions imported as: DRAFT (needs admin review)`);
  console.log(`   Content type: extra_practice (Extra Practice library)`);
  console.log(`   Source: textbooks-qa-nepali (Hugging Face)`);
  console.log(`   License: Apache-2.0`);

  // Save final results
  const resultsPath = `/home/z/my-project/scripts/.nepal-import-state/run-${state.importBatchId}.json`;
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n   Detailed results saved to: ${resultsPath}`);
  console.log(`   State file: ${STATE_FILE}`);

  // Database verification
  console.log(`\n   Database verification:`);
  const draftCount = await db.question.count({
    where: {
      sourceType: "dataset",
      sourceName: "textbooks-qa-nepali",
      status: "draft",
      importBatchId: state.importBatchId,
    },
  });
  console.log(`   Draft questions in this batch: ${draftCount}`);
  const totalDatasetDrafts = await db.question.count({
    where: { sourceType: "dataset", sourceName: "textbooks-qa-nepali", status: "draft" },
  });
  console.log(`   Total Nepal dataset drafts in DB: ${totalDatasetDrafts}`);

  // If the run completed successfully, archive the state file.
  if (generated >= MAX_MCQS_TO_GENERATE || relevantRecords.length < MAX_RECORDS_TO_FETCH) {
    console.log(`\n   ✅ Run completed cleanly. Clearing state file for next run.`);
    clearState();
  } else {
    console.log(`\n   ⏸️ Run incomplete. State saved for resume.`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
}).finally(() => db.$disconnect());
