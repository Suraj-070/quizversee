import test from "node:test";
import assert from "node:assert/strict";
import { quizCountChoices } from "../src/lib/qai-quiz-counts.mjs";
test("a one-question bank always allows a quiz", () => {
  const choices = quizCountChoices([10, 20], 1);
  assert.deepEqual(choices, [{count:1,available:true},{count:10,available:false},{count:20,available:false}]);
});
test("a small bank includes its exact available pool", () => {
  assert.deepEqual(quizCountChoices([5,10],3),[
    {count:1,available:true},{count:3,available:true},{count:5,available:false},{count:10,available:false},
  ]);
});
test("invalid configured counts are ignored and duplicates removed",()=>{
  assert.deepEqual(quizCountChoices([1,1,3.5,-1,0,5,Infinity,1001],5),[
    {count:1,available:true},{count:5,available:true},
  ]);
});
