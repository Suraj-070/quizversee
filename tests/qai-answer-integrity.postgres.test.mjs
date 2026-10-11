/**
 * QAI PostgreSQL integration test.
 * RUN ONLY ON A DISPOSABLE TEST DATABASE, NEVER PRODUCTION.
 *
 * Test runner intentionally requires DATABASE_URL and a second explicit opt-in.
 * It does not import Next.js route handlers; run full authenticated API tests
 * separately against a staging server.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

let dbName = "";
try { dbName = new URL(process.env.DATABASE_URL ?? "").pathname.slice(1); } catch {}
const gate = process.env.QAI_TEST_DISPOSABLE_DB === "YES" && dbName === "qai_test";
const skip = !gate
  ? "Requires explicitly named disposable qai_test database and QAI_TEST_DISPOSABLE_DB=YES"
  : undefined;

test("submittedAt is nullable on a fresh placeholder; duplicate claim succeeds once", { skip }, async () => {
  const db = new PrismaClient();
  const uid = "qai-test-" + Date.now().toString(36);
  let classId, subjectId, topicId, questionId, attemptId, userAnswerId;
  try {
    const klass = await db.class.create({data:{name:uid}});
    classId=klass.id;
    const subj = await db.subject.create({data:{name:uid,classId}});
    subjectId=subj.id;
    const topic = await db.topic.create({data:{name:uid,subjectId}});
    topicId=topic.id;
    const question = await db.question.create({data:{topicId,questionText:uid,optionA:"A1",optionB:"B1",optionC:"C1",optionD:"D1",correctOption:"B",status:"draft"}});
    questionId=question.id;
    const user = await db.user.create({data:{email:uid+"@example.test",name:uid,passwordHash:"unused-integration-test"}});
    const attempt=await db.quizAttempt.create({data:{userId:user.id,topicId,totalQuestions:1,feedbackMode:"exam"}});
    attemptId=attempt.id;
    assert.equal(attempt.feedbackMode,"exam", "Attempt mode must be stored in PostgreSQL");
    const ua = await db.userAnswer.create({data:{userId:user.id,attemptId,questionId,selectedOption:"A",isCorrect:false}});
    userAnswerId=ua.id;
    assert.equal(ua.submittedAt,null);
    const persistedMode = await db.quizAttempt.findUniqueOrThrow({where:{id:attemptId},select:{feedbackMode:true}});
    assert.equal(persistedMode.feedbackMode,"exam");
    const now = new Date();
    const results=await Promise.all([
      db.userAnswer.updateMany({where:{id:userAnswerId,submittedAt:null},data:{submittedAt:now,selectedOption:"B",isCorrect:true}}),
      db.userAnswer.updateMany({where:{id:userAnswerId,submittedAt:null},data:{submittedAt:now,selectedOption:"B",isCorrect:true}}),
    ]);
    assert.equal(results.reduce((sum,r)=>sum+r.count,0),1);
    const final = await db.userAnswer.findUniqueOrThrow({where:{id:userAnswerId}});
    assert.equal(final.selectedOption,"B");
    assert.equal(final.isCorrect,true);
    assert.ok(final.submittedAt);
  } finally {
    // Deleting test user cascades attempts and answer; deleting class cascades curriculum.
    await db.user.deleteMany({where:{name:uid}}).catch(()=>{});
    if (classId) await db.class.delete({where:{id:classId}}).catch(()=>{});
    await db.$disconnect();
  }
});
