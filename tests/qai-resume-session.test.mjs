import test from "node:test";
import assert from "node:assert/strict";
import { buildResumableQuiz } from "../src/lib/qai-resume-session.mjs";

const q = (id, submittedAt = null, selectedOption = null) => ({
  id: "answer-" + id, submittedAt, selectedOption,
  question: { id, questionText: "Question", optionA: "One", optionB: "Two", optionC: "Three", optionD: "Four", correctOption: null, explanation: null, questionImage: null },
});

test("resumes with submitted selections but never reveals correctness", () => {
  const result = buildResumableQuiz({
    id: "a1", completedAt: null, totalQuestions: 2, feedbackMode: "exam",
    answers: [q("q1", "2026-10-11T00:00:00Z", "C"), q("q2")],
  });
  assert.equal(result.feedbackMode, "exam");
  assert.equal(result.currentIndex, 1);
  assert.equal(result.answers.q1.selectedOption, "C");
  assert.equal(result.answers.q1.isCorrect, null);
  assert.equal(result.questions[0].explanation, null);
  assert.equal(result.questions[0].correctOption, undefined);
});

test("unsubmitted placeholders are never treated as real answers", () => {
  const result = buildResumableQuiz({ id: "a2", totalQuestions: 1, feedbackMode: "immediate", completedAt: null, answers: [q("q1", null, "A")] });
  assert.deepEqual(result.answers, {});
  assert.equal(result.currentIndex, 0);
});

test("completed and inconsistent attempts cannot be resumed", () => {
  assert.throws(() => buildResumableQuiz({ id: "a3", completedAt: "done", totalQuestions: 1, answers: [q("q1")] }));
  assert.throws(() => buildResumableQuiz({ id: "a4", completedAt: null, totalQuestions: 2, answers: [q("q1")] }));
});

test("server record order cannot reshuffle an already-started attempt", () => {
  const result = buildResumableQuiz({
    id: "order-test", totalQuestions: 2, feedbackMode: "exam", completedAt: null,
    answers: [q("q2"), q("q1")],
  });
  assert.deepEqual(result.questions.map(item => item.userAnswerId), ["answer-q1", "answer-q2"]);
});
