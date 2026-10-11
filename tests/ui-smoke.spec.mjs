import { test, expect } from "@playwright/test";

const classInfo = { id: "class-9", name: "Class 9" };
const science = {
  id: "science-9",
  name: "Science",
  description: "Nepal curriculum",
  icon: null,
  class: classInfo,
  topicCount: 1,
  questionCount: 40,
};
const user = (role) => ({
  id: "smoke-user",
  email: "smoke@example.test",
  name: "Test Student",
  role,
  createdAt: "2026-01-01T00:00:00.000Z",
  onboardingCompleted: true,
  currentClassId: "class-9",
});

const fixture = {
  "/api/student/my-learning": { subjects: [science], className: "Class 9" },
  "/api/student/announcements": { announcements: [] },
  "/api/student/weak-topics": { weakTopics: [] },
  "/api/student/progress": {
    overview: { quizzesCompleted: 0, avgScore: 0, bestScore: 0 },
    subjects: [],
    recentlyPracticed: [],
  },
  "/api/student/extra-practice": {
    className: "Class 9",
    subjects: [{
      id: "science-9",
      name: "Science",
      icon: null,
      topics: [{
        id: "extra-topic",
        name: "Science Challenge",
        description: "Additional practice",
        questionCount: 8,
      }],
    }],
  },
  "/api/student/explore": {
    topics: [
      {
        id: "extra-topic",
        name: "Science Challenge",
        description: "Additional practice",
        questionCount: 8,
        subjectId: "science-9",
        subjectName: "Science",
        classId: "class-9",
        className: "Class 9",
      },
      {
        id: "extra-topic-2",
        name: "World Geography",
        description: "Explore more",
        questionCount: 12,
        subjectId: "social",
        subjectName: "Social Studies",
        classId: "class-10",
        className: "Class 10",
      },
    ],
  },
  "/api/student/topics": {
    subject: { ...science, class: classInfo },
    topics: [{
      id: "topic-cells",
      name: "Cells",
      description: "Cell structure and functions",
      displayOrder: 1,
      publishedQuestions: 40,
      lastAttempt: null,
    }],
  },
  "/api/student/questions": {
    topic: {
      id: "topic-cells",
      name: "Cells",
      description: "Cell structure and functions",
      contentType: "curriculum",
      subject: { id: "science-9", name: "Science", class: classInfo },
    },
    publishedCount: 40,
    allowedCounts: [{ count: 1, available: true }],
  },
  "/api/student/questions/flagged": { flags: [] },
  "/api/admin/dashboard": {
    classes: 2,
    subjects: 3,
    topics: 4,
    questions: 45,
    publishedQuestions: 40,
    draftQuestions: 5,
    users: 2,
    quizAttempts: 10,
    quizAttemptsToday: 1,
    quizSets: 1,
    publishedQuizSets: 1,
    avgScore: 75,
    recentActivity: [],
    curriculumCoverage: {
      topicCount: 2,
      under40Count: 1,
      priorityTopics: [{
        id: "topic-cells",
        name: "Cells",
        className: "Class 9",
        subjectName: "Science",
        publishedQuestions: 24,
      }],
    },
  },
};
const quizQuestion = {
  id: "question-1",
  questionText: "What is the basic unit of life?",
  optionA: "Cell",
  optionB: "Atom",
  optionC: "Tissue",
  optionD: "Organ",
  explanation: null,
  userAnswerId: "answer-1",
  questionImage: null,
  optionAImage: null,
  optionBImage: null,
  optionCImage: null,
  optionDImage: null,
};

async function mockApi(page, role = "user") {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let payload;
    if (path === "/api/me") payload = { user: user(role) };
    else if (path === "/api/student/attempts" && method === "POST") {
      payload = { attemptId: "attempt-1", questions: [quizQuestion] };
    } else if (path === "/api/student/attempts/attempt-1/answer" && method === "PATCH") {
      payload = { selectedOption: "A", isCorrect: null, correctOption: null, explanation: null };
    } else if (path === "/api/student/attempts/attempt-1/complete" && method === "POST") {
      payload = { completed: true };
    } else if (path === "/api/student/questions/question-1/flag" && method === "GET") {
      payload = { flagged: false };
    } else if (path === "/api/student/questions/question-1/flag" && method === "POST") {
      payload = { flagged: true };
    } else if (Object.hasOwn(fixture, path)) {
      payload = fixture[path];
    } else if (path === "/api/auth/session") {
      payload = {};
    } else {
      return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "No smoke fixture for " + path }) });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
}

test("student dashboard and curriculum/external discovery work on desktop", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back, Test" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your subjects" })).toBeVisible();
  await page.locator("main").getByRole("button", { name: "My Learning", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My Learning" })).toBeVisible();
  await expect(page.getByText("40 questions").first()).toBeVisible();
  await page.locator("header").getByRole("button", { name: "Explore" }).click();
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Science Challenge" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "World Geography" })).toBeVisible();
  await expect(page.getByText("Cells", { exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search supplementary practice topics" }).fill("geography");
  await expect(page.getByRole("heading", { name: "World Geography" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Science Challenge" })).toHaveCount(0);
});

test("mobile navigation and supplementary practice have no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back, Test" })).toBeVisible();
  await page.locator("header").getByRole("button", { name: "Explore" }).click();
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await page.locator("header").getByRole("button", { name: "Practice" }).click();
  await expect(page.getByRole("heading", { name: "Extra Practice" })).toBeVisible();
  await expect(page.getByText("Science Challenge")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("admin dashboard displays question-bank coverage and draft review", async ({ page }) => {
  await mockApi(page, "admin");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Curriculum question coverage")).toBeVisible();
  await expect(page.getByText("24/40")).toBeVisible();
  await expect(page.getByText("Draft Questions")).toBeVisible();
  await page.getByRole("button", { name: "Manage questions" }).click();
  await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();
});

test("exam submission has an accessible dialog that closes on Escape", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.locator("main").getByRole("button", { name: "My Learning", exact: true }).click();
  await page.getByRole("button", { name: /Science/ }).last().click();
  await page.getByRole("button", { name: /Cells/ }).click();
  await expect(page.getByRole("heading", { name: "Cells" })).toBeVisible();
  await page.getByRole("button", { name: /Exam mode/ }).click();
  await page.getByRole("button", { name: /Start Quiz/ }).click();
  await expect(page.getByRole("heading", { name: "What is the basic unit of life?" })).toBeVisible();
  await page.getByRole("button", { name: /Cell/ }).click();
  await page.getByRole("button", { name: "Finish quiz" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Ready to submit?" })).toBeVisible();
  await expect(dialog.getByText("1", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
