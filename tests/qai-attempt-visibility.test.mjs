import test from "node:test";
import assert from "node:assert/strict";
import { visibleAttemptAnswers } from "../src/lib/qai-attempt-visibility.mjs";
const records=[
  {id:"not-done",submittedAt:null,selectedOption:"A",isCorrect:false,question:{id:"q1",correctOption:"B",explanation:"secret",questionText:"Example"}},
  {id:"done",submittedAt:new Date("2026-10-11T00:00:00Z"),selectedOption:"B",isCorrect:true,question:{id:"q2",correctOption:"B",explanation:"secret two",questionText:"Example two"}}
];
test("incomplete attempts cannot reveal correct options, explanations, or correctness",()=>{
  const redacted=visibleAttemptAnswers(records,null);
  assert.deepEqual(redacted.map(a=>a.question.correctOption),[null,null]);
  assert.deepEqual(redacted.map(a=>a.question.explanation),[null,null]);
  assert.deepEqual(redacted.map(a=>a.isCorrect),[null,null]);
  assert.equal(redacted[0].selectedOption,null);
  assert.equal(redacted[1].selectedOption,"B");
});
test("completed attempts retain the existing review response contract",()=>{
  assert.deepEqual(visibleAttemptAnswers(records,new Date()),records);
});
test("source objects are not mutated by redaction",()=>{
  visibleAttemptAnswers(records,null);
  assert.equal(records[0].question.correctOption,"B");
});
