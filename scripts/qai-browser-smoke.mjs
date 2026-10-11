
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const dbUrl = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
if (process.env.QAI_TEST_DISPOSABLE_DB !== "YES" || dbUrl.pathname !== "/qai_test" ||
    !["localhost", "127.0.0.1"].includes(dbUrl.hostname)) {
  throw new Error("Browser tests require disposable localhost qai_test");
}
const base = process.env.QAI_HTTP_BASE_URL ?? "http://127.0.0.1:3000";
const db = new PrismaClient();
const key = "browser-" + Date.now().toString(36);
const password = "ci-only-test-password";
const emails = [];
let klass, browser;

async function visible(locator) { await locator.waitFor({ state: "visible", timeout: 30000 }); }
async function checkWidth(page, screen) {
  const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(size[0] <= size[1] + 4, screen + " has horizontal overflow: " + size);
}
async function testBrowser(viewport, label, email) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const pageErrors = [];
  page.on("pageerror", e => pageErrors.push(e.message));
  try {
    await page.goto(base);
    await visible(page.getByText("Welcome back", { exact: true }));
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await visible(page.getByRole("button", { name: "Get Started" }));
    await page.getByRole("button", { name: "Get Started" }).click();
    await page.getByRole("button", { name: new RegExp(key + " Class") }).click();
    await visible(page.getByRole("heading", { name: "Choose your subjects" }));
    await page.getByRole("button", { name: /Browser Science/ }).click();
    await page.getByRole("button", { name: /Browser Maths/ }).click();
    await page.getByRole("button", { name: /Save & Continue/ }).click();
    await page.getByRole("button", { name: /Start Learning/ }).click();
    await visible(page.getByRole("heading", { name: "Your subjects" }));
    await checkWidth(page, label + " home");
    await page.reload();
    await visible(page.getByRole("heading", { name: "Your subjects" }));

    await page.locator('header button[title="Profile"]').click();
    await visible(page.getByRole("heading", { name: "My Profile" }));
    await visible(page.locator("#academic-class"));
    assert.equal(await page.locator("#academic-class").inputValue(), klass.id);
    assert.equal(await page.getByRole("checkbox", { name: "Browser Maths" }).isChecked(), true);
    await page.getByRole("checkbox", { name: "Browser Maths" }).uncheck();
    await page.getByRole("button", { name: "Save learning subjects" }).click();
    await visible(page.getByText("Class and subjects saved", { exact: true }));
    await page.reload();
    await visible(page.getByRole("heading", { name: "Your subjects" }));
    await page.locator('header button[title="Profile"]').click();
    await visible(page.getByRole("heading", { name: "My Profile" }));
    assert.equal(await page.getByRole("checkbox", { name: "Browser Maths" }).isChecked(), false);
    await checkWidth(page, label + " profile");

    await page.reload();
    await visible(page.getByRole("heading", { name: "Your subjects" }));
    await page.getByRole("button", { name: /Go to My Learning/ }).click();
    await visible(page.getByRole("heading", { name: "My Learning" }));
    await page.getByRole("button", { name: /Browser Science/ }).click();
    await page.getByRole("button", { name: /Browser Single Topic/ }).click();
    await visible(page.getByRole("heading", { name: "Browser Single Topic" }));
    await page.locator("#custom-question-count").fill("1");
    await page.getByRole("button", { name: /Exam mode/ }).click();
    await checkWidth(page, label + " one-question setup");
    await page.getByRole("button", { name: /Start Quiz \(1 question\)/ }).click();
    await visible(page.getByText("Browser single: choose B", { exact: true }));
    await page.keyboard.press("2");
    await page.getByRole("button", { name: /Finish quiz/ }).click();
    await visible(page.getByRole("heading", { name: "Ready to submit?" }));
    await page.getByRole("button", { name: "Submit exam" }).click();
    await visible(page.getByRole("heading", { name: "Quiz Complete" }));
    await checkWidth(page, label + " results");

    // Return to Home, open a longer exam, then leave before finishing.
    await page.locator("header button").first().click();
    await visible(page.getByRole("heading", { name: "Your subjects" }));
    await page.getByRole("button", { name: /Go to My Learning/ }).click();
    await page.getByRole("button", { name: /Browser Science/ }).click();
    await page.getByRole("button", { name: /Browser Two Topic/ }).click();
    await visible(page.getByRole("heading", { name: "Browser Two Topic" }));
    await page.locator("#custom-question-count").fill("2");
    await page.getByRole("button", { name: /Exam mode/ }).click();
    await page.getByRole("button", { name: /Start Quiz \(2 questions\)/ }).click();
    await visible(page.getByText(/Browser pair:/));
    await page.keyboard.press("2");
    await page.getByRole("button", { name: /Next question/ }).click();
    await page.locator("header button").first().click();
    await visible(page.getByRole("heading", { name: "Your subjects" }));
    await visible(page.getByRole("heading", { name: "Continue Quiz" }));
    await page.reload();
    await visible(page.getByRole("heading", { name: "Your subjects" }));
    await visible(page.getByRole("heading", { name: "Continue Quiz" }));
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await visible(page.getByText(/Browser pair:/));
    await checkWidth(page, label + " resumed quiz");
    await page.keyboard.press("2");
    await page.getByRole("button", { name: /Finish quiz/ }).click();
    await page.getByRole("button", { name: "Submit exam" }).click();
    await visible(page.getByRole("heading", { name: "Quiz Complete" }));
    await page.locator("header button").first().click();
    await visible(page.getByRole("heading", { name: "Your subjects" }));
    assert.equal(await page.getByRole("heading", { name: "Continue Quiz" }).count(), 0);
    assert.deepEqual(pageErrors, [], label + " unhandled browser errors");
    console.log("PASS " + label + " desktop/mobile student journey including profile persistence and reload-safe resume");
  } catch (error) {
    await fs.mkdir("/tmp/qai-browser-artifacts", { recursive: true });
    await page.screenshot({ path: "/tmp/qai-browser-artifacts/" + label + "-failed.png", fullPage: true }).catch(() => {});
    console.error(label + " failed at " + page.url() + ": ", error);
    console.error("Browser errors: " + pageErrors);
    throw error;
  } finally {
    await context.close();
  }
}

try {
  klass = await db.class.create({ data: { name: key + " Class" } });
  const science = await db.subject.create({ data: { classId: klass.id, name: "Browser Science" } });
  await db.subject.create({ data: { classId: klass.id, name: "Browser Maths" } });
  const single = await db.topic.create({ data: { subjectId: science.id, name: "Browser Single Topic" } });
  const pair = await db.topic.create({ data: { subjectId: science.id, name: "Browser Two Topic" } });
  const addQuestion = (topicId, questionText) => db.question.create({
    data: { topicId, questionText, status: "published", correctOption: "B",
      optionA: "One", optionB: "Two", optionC: "Three", optionD: "Four", explanation: "B is correct." },
  });
  await addQuestion(single.id, "Browser single: choose B");
  await addQuestion(pair.id, "Browser pair: first");
  await addQuestion(pair.id, "Browser pair: second");
  const passwordHash = await bcrypt.hash(password, 10);
  for (const label of ["desktop", "mobile"]) {
    const email = key + "-" + label + "@example.test";
    emails.push(email);
    await db.user.create({ data: { email, name: "Browser Student", passwordHash, role: "user" } });
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  await testBrowser({ width: 1280, height: 900 }, "desktop", emails[0]);
  await testBrowser({ width: 390, height: 844 }, "mobile", emails[1]);
} finally {
  await browser?.close();
  await db.user.deleteMany({ where: { email: { in: emails } } });
  if (klass) await db.class.delete({ where: { id: klass.id } });
  await db.$disconnect();
}
