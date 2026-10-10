/**
 * Quizverse foundation question importer.
 * npm install -D tsx
 * npx tsx scripts/import-foundation-questions.ts
 * npx tsx scripts/import-foundation-questions.ts --apply --confirm=QUIZVERSE_QUESTIONS
 *
 * This is a draft-only importer. It creates an explicit Extra Practice review topic,
 * not a CDC curriculum chapter. No updates or deletes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

type QuestionRow = {
  id: string; grade: number; subject: string; questionText: string;
  optionA: string; optionB: string; optionC: string; optionD: string;
  correctOption: string; explanation: string; status: string; contentType: string;
};
type Batch = { schemaVersion: number; questions: QuestionRow[] };
const path = resolve(process.cwd(), "curriculum/questions/foundation-batch-001.json");
const batch = JSON.parse(readFileSync(path, "utf8")) as Batch;
const apply = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm=QUIZVERSE_QUESTIONS");
const db = new PrismaClient();
const REVIEW_TOPIC = "General Practice — Pending Curriculum Review";
const SOURCE_NAME = "Quizverse Original Foundation Batch 001";

function requireThat(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function normalize(value: string) { return value.trim().toLocaleLowerCase(); }
function questionFingerprint(q: QuestionRow) {
  return createHash("sha256").update([q.grade,q.subject,normalize(q.questionText)].join("|")).digest("hex");
}
async function main() {
  requireThat(batch.schemaVersion === 1 && Array.isArray(batch.questions), "Invalid batch");
  if (apply) requireThat(confirmed, "Pass --apply --confirm=QUIZVERSE_QUESTIONS to write drafts.");
  const ids = new Set<string>(), texts = new Set<string>();
  for (const q of batch.questions) {
    requireThat(Number.isInteger(q.grade) && q.grade >= 9 && q.grade <= 12, "Invalid grade");
    for (const key of ["id","subject","questionText","optionA","optionB","optionC","optionD","explanation"] as const)
      requireThat(typeof q[key] === "string" && q[key].trim(), "Empty field " + key + " in " + q.id);
    requireThat(["A","B","C","D"].includes(q.correctOption), "Invalid answer in " + q.id);
    requireThat(q.status === "draft" && q.contentType === "extra_practice", "All imported questions must be draft extra practice");
    requireThat(!ids.has(q.id), "Duplicate ID " + q.id);
    ids.add(q.id);
    const fp = questionFingerprint(q);
    requireThat(!texts.has(fp), "Duplicate question text " + q.id);
    texts.add(fp);
    requireThat(new Set([q.optionA,q.optionB,q.optionC,q.optionD].map(normalize)).size === 4, "Duplicate options in " + q.id);
  }
  let createQuestions = 0, skipQuestions = 0, missingSubjects = 0, newTopics = 0;
  const subjects = new Map<string,{id:string; topicId?:string; exists:boolean}>();
  try {
    // Validate all target subject associations before writing anything.
    for (const q of batch.questions) {
      const key = q.grade + "/" + q.subject;
      if (subjects.has(key)) continue;
      const klass = await db.class.findMany({where:{name:"Class "+q.grade}});
      requireThat(klass.length === 1, "Class not found or ambiguous: " + q.grade);
      const candidates = await db.subject.findMany({where:{classId:klass[0].id,name:q.subject}});
      if (candidates.length !== 1) {
        missingSubjects++;
        throw new Error("Subject not found or ambiguous: " + key + ". Check existing names before import.");
      }
      const topic = await db.topic.findMany({where:{subjectId:candidates[0].id,name:REVIEW_TOPIC}});
      requireThat(topic.length <= 1, "Ambiguous review topic: " + key);
      subjects.set(key,{id:candidates[0].id,topicId:topic[0]?.id,exists:!!topic[0]});
      if (!topic[0]) newTopics++;
    }
    // Resolve previously imported IDs and same-topic question text, even if provenance changes.
    for (const q of batch.questions) {
      const key = q.grade + "/" + q.subject;
      const {topicId}=subjects.get(key)!;
      const bySource = await db.question.findFirst({where:{sourceName:SOURCE_NAME,sourceQuestionId:q.id}});
      const byText = await db.question.findFirst({where:{topic:{subjectId:subjects.get(key)!.id},questionText:q.questionText}});
      if (bySource || byText) {
        skipQuestions++; console.log("SKIP "+q.id);continue;
      }
      createQuestions++;console.log("CREATE draft "+q.id);
    }
    console.log(JSON.stringify({mode:apply?"APPLY_REQUESTED":"DRY_RUN",total:batch.questions.length,createQuestions,skipQuestions,newTopics,missingSubjects},null,2));
    if (!apply) return;
    // Import after full validation. Re-check inside transaction to make repeat runs safe.
    await db.$transaction(async tx=>{
      for (const q of batch.questions) {
        const key=q.grade+"/"+q.subject;const target=subjects.get(key)!;
        let topicId=target.topicId;
        if (!topicId) {
          const existing=await tx.topic.findFirst({where:{subjectId:target.id,name:REVIEW_TOPIC}});
          const topic=existing??await tx.topic.create({data:{subjectId:target.id,name:REVIEW_TOPIC,contentType:"extra_practice",description:"Unmapped foundation practice; pending curriculum and editorial review."}});
          topicId=topic.id;target.topicId=topicId;
        }
        const exists=await tx.question.findFirst({where:{OR:[{sourceName:SOURCE_NAME,sourceQuestionId:q.id},{topicId,questionText:q.questionText}]}});
        if (exists)continue;
        await tx.question.create({data:{topicId,questionText:q.questionText,optionA:q.optionA,optionB:q.optionB,optionC:q.optionC,optionD:q.optionD,correctOption:q.correctOption,explanation:q.explanation,status:"draft",contentType:"extra_practice",sourceType:"manual",sourceName:SOURCE_NAME,sourceQuestionId:q.id,importBatchId:"foundation-001"}});
      }
    },{timeout:60000});
    console.log("APPLIED draft batch. Nothing was published; review questions in admin first.");
  } finally { await db.$disconnect(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
