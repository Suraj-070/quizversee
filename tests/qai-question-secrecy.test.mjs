import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Static regression guard. Not a replacement for authenticated API tests. */
const starters = [
  "src/app/api/student/attempts/route.ts",
  "src/app/api/student/smart-practice/route.ts",
  "src/app/api/student/attempts/practice-wrong/route.ts",
];
for (const file of starters) {
  test(file + " redacts explanation in quiz-start responses", () => {
    const source = readFileSync(file, "utf8");
    assert.match(source, /explanation:\s*null[\s\S]*userAnswerId:/, "Quiz start must not return explanation");
    assert.doesNotMatch(source, /return \{ \.{3}q, userAnswerId:/, "Do not spread raw question into response");
  });
}
test("unsubmitted or incomplete answers are ineligible for AI explanations", () => {
  const source = readFileSync("src/app/api/student/questions/[id]/ai-explanation/route.ts", "utf8");
  assert.match(source, /submittedAt:\s*\{\s*not:\s*null\s*\}/);
  assert.match(source, /completedAt:\s*\{\s*not:\s*null\s*\}/);
});
