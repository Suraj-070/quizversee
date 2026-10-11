/**
 * Authenticated HTTP smoke test for QAI. ONLY an ephemeral localhost qai_test DB.
 * This script creates fixture accounts and curriculum in the disposable database.
 * It MUST NOT run against Supabase or a shared environment.
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const dbUrl = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
const safeDatabase =
  process.env.QAI_TEST_DISPOSABLE_DB === "YES" &&
  dbUrl.pathname === "/qai_test" &&
  ["127.0.0.1", "localhost"].includes(dbUrl.hostname);
if (!safeDatabase) {
  throw new Error("Refusing smoke tests outside an explicitly disposable localhost qai_test database");
}

const base = process.env.QAI_HTTP_BASE_URL ?? "http://127.0.0.1:3000";
const prisma = new PrismaClient();
const unique = Date.now().toString(36);
const password = "ci-test-only-passphrase";
const email = `smoke-student-${unique}@example.test`;
const student2Email = `smoke-other-${unique}@example.test`;

function browser() {
  const jar = new Map();
  const cookie = () => [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  return async function request(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    if (jar.size) headers.cookie = cookie();
    const response = await fetch(base + path, { ...options, headers, redirect: "manual" });
    for (const line of response.headers.getSetCookie()) {
      const item = line.split(";")[0];
      const equal = item.indexOf("=");
      if (equal > 0) {
        const name = item.slice(0, equal);
        const value = item.slice(equal + 1);
        if (value) jar.set(name, value);
        else jar.delete(name);
      }
    }
    const raw = await response.text();
    let body = {};
    try { body = JSON.parse(raw); } catch { body = { text: raw.slice(0, 200) }; }
    return { response, body };
  };
}

async function login(request, userEmail) {
  const csrf = await request("/api/auth/csrf");
  assert.equal(csrf.response.status, 200, "CSRF endpoint available");
  assert.ok(csrf.body.csrfToken, "CSRF token available");
  const result = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: userEmail, password,
      csrfToken: csrf.body.csrfToken,
      callbackUrl: base + "/",
      json: "true",
    }),
  });
  assert.ok(result.response.status < 400, `Login failed: ${JSON.stringify(result.body)}`);
  const me = await request("/api/me");
  assert.equal(me.body.user?.email, userEmail, "Authenticated session identifies the test student");
}

async function json(request, path, method, payload, expectedStatus) {
  const result = await request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(result.response.status, expectedStatus, `${method} ${path} returned ${result.response.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

let classId;
try {
  const klass = await prisma.class.create({ data: { name: "QAI Smoke Class " + unique } });
  classId = klass.id;
  const subject = await prisma.subject.create({ data: { name: "Smoke Science", classId } });
  const secondSubject = await prisma.subject.create({ data: { name: "Smoke Maths", classId } });
  const topic = await prisma.topic.create({ data: { name: "Smoke Motion", subjectId: subject.id } });
  await prisma.question.create({
    data: { topicId: topic.id, questionText: "What is two plus two?",
      optionA: "Three", optionB: "Four", optionC: "Five", optionD: "Six",
      correctOption: "B", explanation: "Two plus two is four.", status: "published" },
  });
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, name: "Smoke Student", passwordHash, role: "user" } });
  await prisma.user.create({ data: { email: student2Email, name: "Other Smoke Student", passwordHash, role: "user" } });

  const request = browser();
  await login(request, email);

  await json(request, "/api/student/academic-profile", "POST", {
    classId, subjectIds: [subject.id, secondSubject.id],
  }, 200);
  const profile = await request("/api/student/academic-profile");
  assert.deepEqual(new Set(profile.body.subjects.map(x => x.id)), new Set([subject.id, secondSubject.id]));

  const setup = await request(`/api/student/questions?topicId=${topic.id}`);
  assert.equal(setup.response.status, 200);
  assert.equal(setup.body.publishedCount, 1);
  assert.ok(setup.body.allowedCounts.some(x => x.count === 1 && x.available), "One-question option exists");

  const started = await json(request, "/api/student/attempts", "POST", {
    topicId: topic.id, totalQuestions: 1, feedbackMode: "exam",
  }, 201);
  assert.equal(started.questions.length, 1);
  assert.ok(!("correctOption" in started.questions[0]), "Correct option is hidden at quiz start");
  assert.equal(started.questions[0].explanation, null);
  const attemptId = started.attemptId;
  const userAnswerId = started.questions[0].userAnswerId;

  let detail = await request(`/api/student/attempts?attemptId=${attemptId}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.attempt.answers[0].selectedOption, null, "Placeholder is unsubmitted");
  assert.equal(detail.body.attempt.answers[0].question.correctOption, null, "Answers hidden before completion");

  const submitted = await json(request, `/api/student/attempts/${attemptId}/answer`, "PATCH", {
    userAnswerId, selectedOption: "B", reveal: true,
  }, 200);
  assert.equal(submitted.recorded, true);
  assert.ok(!("isCorrect" in submitted), "Exam mode suppresses correctness even if reveal=true");

  detail = await request(`/api/student/attempts?attemptId=${attemptId}`);
  assert.equal(detail.body.attempt.answers[0].selectedOption, "B");
  assert.equal(detail.body.attempt.answers[0].question.correctOption, null);

  await json(request, `/api/student/attempts/${attemptId}/answer`, "PATCH", {
    userAnswerId, selectedOption: "A", reveal: true,
  }, 409);

  const other = browser();
  await login(other, student2Email);
  const denied = await other(`/api/student/attempts?attemptId=${attemptId}`);
  assert.equal(denied.response.status, 404, "Other students cannot inspect attempts");

  const completed = await json(request, `/api/student/attempts/${attemptId}/complete`, "POST", {}, 200);
  assert.equal(completed.correctAnswers, 1);
  assert.equal(completed.totalQuestions, 1);

  detail = await request(`/api/student/attempts?attemptId=${attemptId}`);
  assert.ok(detail.body.attempt.completedAt);
  assert.equal(detail.body.attempt.answers[0].question.correctOption, "B");
  const listed = await request("/api/student/attempts");
  assert.equal(listed.body.attempts.find(x => x.id === attemptId)?.resumable, false);

  // Concurrency: two requests racing for the same answer must claim it once.
  const secondAttempt = await json(request, "/api/student/attempts", "POST", {
    topicId: topic.id, totalQuestions: 1, feedbackMode: "exam",
  }, 201);
  const secondAnswerId = secondAttempt.questions[0].userAnswerId;
  const secondQuestionId = secondAttempt.questions[0].id;
  const beforeMastery = await prisma.questionMastery.findUniqueOrThrow({
    where: { userId_questionId: {
      userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id,
      questionId: secondQuestionId,
    } },
  });
  const sendContendingAnswer = (selectedOption) => request(
    `/api/student/attempts/${secondAttempt.attemptId}/answer`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userAnswerId: secondAnswerId, selectedOption, reveal: true }),
    },
  );
  const racingAnswers = await Promise.all([
    sendContendingAnswer("A"),
    sendContendingAnswer("B"),
  ]);
  assert.deepEqual(
    racingAnswers.map(x => x.response.status).sort((a, b) => a - b),
    [200, 409],
    "Exactly one simultaneous answer submission must win",
  );
  const afterMastery = await prisma.questionMastery.findUniqueOrThrow({
    where: { userId_questionId: { userId: beforeMastery.userId, questionId: secondQuestionId } },
  });
  assert.equal(afterMastery.timesSeen, beforeMastery.timesSeen + 1, "Mastery updated exactly once");
  const [finishOne, finishTwo] = await Promise.all([
    request(`/api/student/attempts/${secondAttempt.attemptId}/complete`, { method: "POST" }),
    request(`/api/student/attempts/${secondAttempt.attemptId}/complete`, { method: "POST" }),
  ]);
  assert.equal(finishOne.response.status, 200, "First concurrent completion succeeds");
  assert.equal(finishTwo.response.status, 200, "Second concurrent completion is idempotent");
  assert.equal(finishOne.body.completedAt, finishTwo.body.completedAt,
    "Concurrent completion records just one completion timestamp");
  const blockedAfterFinish = await sendContendingAnswer("C");
  assert.notEqual(blockedAfterFinish.response.status, 200, "Completed attempt cannot receive new answers");

  // Profile edits replace rather than duplicate saved class/subjects.
  await json(request, "/api/student/academic-profile", "POST", { classId, subjectIds: [secondSubject.id] }, 200);
  const changed = await request("/api/student/academic-profile");
  assert.deepEqual(changed.body.subjects.map(x => x.id), [secondSubject.id]);

  console.log("QAI authenticated HTTP smoke test passed: login, academic saving, one-question exam, redaction, duplicate protection, completion, concurrent claim/finish races and isolation.");
} finally {
  await prisma.user.deleteMany({ where: { email: { in: [email, student2Email] } } });
  if (classId) await prisma.class.delete({ where: { id: classId } });
  await prisma.$disconnect();
}
