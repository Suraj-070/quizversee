import test from "node:test";
import assert from "node:assert/strict";
import { canRevealSubmittedAnswer } from "../src/lib/qai-answer-visibility.mjs";
test("exam attempt cannot reveal even when request asks for feedback", () => {
  assert.equal(canRevealSubmittedAnswer("exam", true), false);
});
test("immediate practice reveals only when requested", () => {
  assert.equal(canRevealSubmittedAnswer("immediate", true), true);
  assert.equal(canRevealSubmittedAnswer("immediate", false), false);
});
test("unknown persisted modes fail closed", () => {
  assert.equal(canRevealSubmittedAnswer("unexpected", true), false);
});
