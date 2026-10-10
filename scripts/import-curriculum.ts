/**
 * Safe Quizverse curriculum importer.
 * Usage:
 *   npx tsx scripts/import-curriculum.ts                  # preview only
 *   npx tsx scripts/import-curriculum.ts --apply --confirm=QUIZVERSE_CURRICULUM
 *
 * Install dev dependency if needed: npm install -D tsx
 * No delete/update operations. Chapter creation requires verified source metadata.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Chapter = { name: string; displayOrder?: number };
type SubjectPlan = {
  name: string;
  displayOrder?: number;
  chapters: Chapter[];
  chapterVerification: "pending" | "verified";
  chapterSource?: { url: string; edition: string };
};
type GradePlan = { name: string; grade: number; subjects: SubjectPlan[] };
type Manifest = { schemaVersion: number; grades: GradePlan[] };

const manifestPath = resolve(process.cwd(), "curriculum/nepal-grades-9-12.plan.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
const apply = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm=QUIZVERSE_CURRICULUM");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validate() {
  assert(manifest.schemaVersion === 1, "Unsupported manifest schemaVersion");
  assert(Array.isArray(manifest.grades), "grades must be an array");
  const gradeNames = new Set<string>();
  for (const grade of manifest.grades) {
    assert(typeof grade.name === "string" && grade.name.trim(), "Invalid class name");
    assert(!gradeNames.has(grade.name.toLowerCase()), "Duplicate class in manifest: " + grade.name);
    gradeNames.add(grade.name.toLowerCase());
    assert(Array.isArray(grade.subjects), "Missing subjects in " + grade.name);
    const subjects = new Set<string>();
    for (const subject of grade.subjects) {
      assert(typeof subject.name === "string" && subject.name.trim(), "Invalid subject name");
      assert(!subjects.has(subject.name.toLowerCase()), "Duplicate subject: " + subject.name);
      subjects.add(subject.name.toLowerCase());
      assert(Array.isArray(subject.chapters), "Missing chapters array");
      assert(subject.chapterVerification === "pending" || subject.chapterVerification === "verified", "Invalid chapter verification");
      assert(subject.chapters.length === 0 || (subject.chapterVerification === "verified" && !!subject.chapterSource?.url && !!subject.chapterSource?.edition),
        "Chapters require verified status, source URL, and edition: " + subject.name);
      const chapters = new Set<string>();
      for (const chapter of subject.chapters) {
        assert(typeof chapter.name === "string" && chapter.name.trim(), "Invalid chapter name");
        assert(!chapters.has(chapter.name.toLowerCase()), "Duplicate chapter: " + chapter.name);
        chapters.add(chapter.name.toLowerCase());
      }
    }
  }
}

async function main() {
  validate();
  if (apply && !confirmed) throw new Error("To write data, pass --apply --confirm=QUIZVERSE_CURRICULUM");
  const db = new PrismaClient();
  let missingClasses = 0, missingSubjects = 0, missingChapters = 0;
  try {
    for (const grade of manifest.grades) {
      const classes = await db.class.findMany({ where: { name: grade.name } });
      assert(classes.length <= 1, "Ambiguous class in DB: " + grade.name);
      let klass = classes[0];
      if (!klass) {
        missingClasses++;
        console.log("[class] CREATE " + grade.name);
        if (apply) klass = await db.class.create({ data: { name: grade.name, displayOrder: grade.grade } });
      }
      for (const subject of grade.subjects) {
        const existing = klass ? await db.subject.findMany({ where: { classId: klass.id, name: subject.name } }) : [];
        assert(existing.length <= 1, "Ambiguous subject in DB: " + subject.name);
        let row = existing[0];
        if (!row) {
          missingSubjects++;
          console.log("[subject] CREATE " + grade.name + " / " + subject.name);
          if (apply) {
            assert(klass, "Missing parent class");
            row = await db.subject.create({ data: { classId: klass.id, name: subject.name, displayOrder: subject.displayOrder ?? 0 } });
          }
        }
        for (const chapter of subject.chapters) {
          const existingTopics = row ? await db.topic.findMany({ where: { subjectId: row.id, name: chapter.name } }) : [];
          assert(existingTopics.length <= 1, "Ambiguous topic in DB: " + chapter.name);
          if (!existingTopics.length) {
            missingChapters++;
            console.log("[chapter] CREATE " + grade.name + " / " + subject.name + " / " + chapter.name);
            if (apply) {
              assert(row, "Missing parent subject");
              await db.topic.create({ data: { subjectId: row.id, name: chapter.name, displayOrder: chapter.displayOrder ?? 0, contentType: "curriculum" } });
            }
          }
        }
      }
    }
    console.log(JSON.stringify({ mode: apply ? "APPLIED" : "DRY_RUN", missingClasses, missingSubjects, missingChapters }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
