/**
 * Bulk import questions from a JSON package.
 *
 * Usage: bun run scripts/import-questions.ts /path/to/extracted/folder
 *
 * The folder should contain:
 *   - *.json files (one per topic)
 *   - images/ folder (referenced by questionImage paths)
 *
 * Each JSON file structure:
 *   {
 *     "class": "Class 9",
 *     "subject": "Science",
 *     "topic": "Force & Motion",
 *     "questions": [
 *       {
 *         "question": "Which ...?",
 *         "questionImage": "images/force-motion-q1.png",  // optional
 *         "options": {
 *           "A": { "text": "...", "image": null },
 *           "B": { "text": "...", "image": null },
 *           "C": { "text": "...", "image": null },
 *           "D": { "text": "...", "image": null }
 *         },
 *         "answer": "A",
 *         "explanation": "..."
 *       }
 *     ]
 *   }
 *
 * The script:
 *   1. Finds or creates the Class (by name)
 *   2. Finds or creates the Subject under that class
 *   3. Finds or creates the Topic under that subject
 *   4. For each question, reads any referenced image and converts to base64
 *   5. Creates the Question with status="published"
 *
 * Idempotent: re-running won't duplicate topics, but WILL create duplicate
 * questions (since questions don't have a natural unique key). To re-run
 * cleanly, delete the questions for the affected topics first.
 */
import { readdir, readFile, stat } from "fs/promises";
import { join, dirname, resolve } from "path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findOrCreateClass(name: string) {
  const existing = await db.class.findFirst({ where: { name } });
  if (existing) return existing;
  return db.class.create({
    data: { name, description: null, isActive: true, displayOrder: 1 },
  });
}

async function findOrCreateSubject(classId: string, name: string) {
  const existing = await db.subject.findFirst({ where: { classId, name } });
  if (existing) return existing;
  return db.subject.create({
    data: {
      classId,
      name,
      description: null,
      icon: "flask-conical",
      isActive: true,
      displayOrder: 1,
    },
  });
}

async function findOrCreateTopic(subjectId: string, name: string) {
  const existing = await db.topic.findFirst({ where: { subjectId, name } });
  if (existing) return existing;
  return db.topic.create({
    data: {
      subjectId,
      name,
      description: null,
      isActive: true,
      displayOrder: 1,
    },
  });
}

/** Reads an image file and returns a base64 data URI. */
async function imageToDataUri(
  imagePath: string,
  baseDir: string
): Promise<string | null> {
  if (!imagePath) return null;
  const fullPath = resolve(baseDir, imagePath);
  try {
    await stat(fullPath);
  } catch {
    console.warn(`  ⚠️  Image not found: ${fullPath}`);
    return null;
  }
  const buffer = await readFile(fullPath);
  const ext = imagePath.toLowerCase().split(".").pop();
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "gif"
          ? "image/gif"
          : ext === "webp"
            ? "image/webp"
            : ext === "svg"
              ? "image/svg+xml"
              : "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const folder = process.argv[2];
  if (!folder) {
    console.error("Usage: bun run scripts/import-questions.ts /path/to/folder");
    process.exit(1);
  }

  const baseDir = resolve(folder);
  console.log(`📂 Importing from: ${baseDir}`);

  const files = (await readdir(baseDir)).filter((f) => f.endsWith(".json"));
  console.log(`📄 Found ${files.length} JSON files\n`);

  let totalQuestions = 0;
  let totalImages = 0;

  for (const file of files) {
    const filePath = join(baseDir, file);
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as {
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
        answer: "A" | "B" | "C" | "D";
        explanation: string;
      }>;
    };

    console.log(`\n📋 ${file}`);
    console.log(`   Class: ${data.class} | Subject: ${data.subject} | Topic: ${data.topic}`);
    console.log(`   ${data.questions.length} questions`);

    // Find or create the hierarchy
    const klass = await findOrCreateClass(data.class);
    const subject = await findOrCreateSubject(klass.id, data.subject);
    const topic = await findOrCreateTopic(subject.id, data.topic);
    console.log(`   classId=${klass.id} subjectId=${subject.id} topicId=${topic.id}`);

    // Delete existing questions for this topic (so re-runs don't duplicate)
    const deleted = await db.question.deleteMany({
      where: { topicId: topic.id },
    });
    if (deleted.count > 0) {
      console.log(`   🗑️  Cleared ${deleted.count} existing questions`);
    }

    // Import each question
    for (const q of data.questions) {
      // Convert images to data URIs
      const questionImage = q.questionImage
        ? await imageToDataUri(q.questionImage, baseDir)
        : null;
      const optionAImage = q.options.A.image
        ? await imageToDataUri(q.options.A.image, baseDir)
        : null;
      const optionBImage = q.options.B.image
        ? await imageToDataUri(q.options.B.image, baseDir)
        : null;
      const optionCImage = q.options.C.image
        ? await imageToDataUri(q.options.C.image, baseDir)
        : null;
      const optionDImage = q.options.D.image
        ? await imageToDataUri(q.options.D.image, baseDir)
        : null;

      if (questionImage) totalImages++;

      await db.question.create({
        data: {
          topicId: topic.id,
          questionText: q.question,
          optionA: q.options.A.text,
          optionB: q.options.B.text,
          optionC: q.options.C.text,
          optionD: q.options.D.text,
          correctOption: q.answer,
          explanation: q.explanation || null,
          status: "published",
          questionImage,
          optionAImage,
          optionBImage,
          optionCImage,
          optionDImage,
        },
      });
      totalQuestions++;
    }
    console.log(`   ✅ Imported ${data.questions.length} questions`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 Import complete!`);
  console.log(`   Topics imported: ${files.length}`);
  console.log(`   Total questions: ${totalQuestions}`);
  console.log(`   Questions with images: ${totalImages}`);

  await db.$disconnect();
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
