import { test, expect } from "@playwright/test";

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("CiTest-only-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("real student APIs enforce curriculum boundaries and answer secrecy", async ({ page }) => {
  await login(page, "ci-student@example.test");
  await expect(page.getByRole("heading", { name: "Welcome back, CI" })).toBeVisible();

  const mine = await page.request.get("/api/student/my-learning");
  expect(mine.ok()).toBeTruthy();
  const mineBody = await mine.json();
  expect(mineBody.subjects).toHaveLength(1);
  expect(mineBody.subjects[0].topicCount).toBe(1);
  expect(mineBody.subjects[0].questionCount).toBe(2);

  const topics = await page.request.get("/api/student/topics?subjectId=ci-science");
  expect(topics.ok()).toBeTruthy();
  const topicBody = await topics.json();
  expect(topicBody.topics.map((topic) => topic.id)).toEqual(["ci-cells"]);

  const discover = await page.request.get("/api/student/explore");
  expect(discover.ok()).toBeTruthy();
  expect((await discover.json()).topics.map((topic) => topic.id)).toEqual(["ci-extra"]);

  const available = await page.request.get("/api/student/questions?topicId=ci-cells");
  expect(available.ok()).toBeTruthy();
  expect((await available.json()).publishedCount).toBe(2);

  const started = await page.request.post("/api/student/attempts", {
    data: { topicId: "ci-cells", totalQuestions: 2 },
  });
  expect(started.status()).toBe(201);
  const startBody = await started.json();
  expect(startBody.attemptId).toBeTruthy();
  expect(startBody.questions.map((q) => q.id).sort()).toEqual(["ci-q1", "ci-q2"]);
  for (const question of startBody.questions) {
    expect(question).not.toHaveProperty("correctOption");
    expect(question.explanation).toBeNull();
  }

  const pending = await page.request.get("/api/student/attempts?attemptId=" + startBody.attemptId);
  expect(pending.status()).toBe(409);
  expect(JSON.stringify(await pending.json())).not.toContain("correctOption");

  const first = await page.request.patch("/api/student/attempts/" + startBody.attemptId + "/answer", {
    data: { userAnswerId: startBody.questions[0].userAnswerId, selectedOption: "A", reveal: false },
  });
  expect(first.ok()).toBeTruthy();
  const firstBody = await first.json();
  expect(firstBody.recorded).toBe(true);
  expect(firstBody).not.toHaveProperty("correctOption");
  expect(firstBody).not.toHaveProperty("explanation");

  const second = await page.request.patch("/api/student/attempts/" + startBody.attemptId + "/answer", {
    data: { userAnswerId: startBody.questions[1].userAnswerId, selectedOption: "B", reveal: true },
  });
  expect(second.ok()).toBeTruthy();
  expect(await second.json()).toHaveProperty("correctOption");

  const completed = await page.request.post("/api/student/attempts/" + startBody.attemptId + "/complete");
  expect(completed.ok()).toBeTruthy();
  const review = await page.request.get("/api/student/attempts?attemptId=" + startBody.attemptId);
  expect(review.ok()).toBeTruthy();
  const reviewBody = await review.json();
  expect(reviewBody.attempt.completedAt).toBeTruthy();
  expect(reviewBody.attempt.answers).toHaveLength(2);
  for (const answer of reviewBody.attempt.answers) {
    expect(answer.question.correctOption).toBeTruthy();
  }

  const denied = await page.request.get("/api/admin/dashboard");
  expect([401, 403]).toContain(denied.status());
});

test("real admin login can retrieve curriculum coverage without production DB", async ({ page }) => {
  await login(page, "ci-admin@example.test");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 2 })).toBeVisible();
  const response = await page.request.get("/api/admin/dashboard");
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.curriculumCoverage.topicCount).toBe(1);
  expect(data.curriculumCoverage.priorityTopics.map((t) => t.id)).toContain("ci-cells");
});
