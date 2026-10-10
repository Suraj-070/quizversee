import test from "node:test";
import assert from "node:assert/strict";
import {chooseAdaptiveQuestions} from "../src/lib/qai-smart-selector.mjs";
const q=(...ids)=>ids.map(id=>({id}));
test("cold start selects valid unique IDs",()=>{
 const ids=chooseAdaptiveQuestions({questions:q("a","b","c"),mastery:[],count:3,random:()=>0.5});
 assert.equal(new Set(ids).size,3);
 assert.deepEqual(ids.sort(),["a","b","c"]);
});
test("prioritizes overdue weak question",()=>{
 const ids=chooseAdaptiveQuestions({questions:q("weak","strong"),mastery:[
 {questionId:"weak",timesSeen:5,timesCorrect:0,nextDueAt:"2024-01-01"},
 {questionId:"strong",timesSeen:5,timesCorrect:5,nextDueAt:"2099-01-01"}
 ],count:1,now:new Date("2026-01-01"),random:()=>0.5});
 assert.deepEqual(ids,["weak"]);
});
test("avoids recent item when alternatives exist",()=>{
 const ids=chooseAdaptiveQuestions({questions:q("a","b"),mastery:[],count:1,recentIds:["a"],random:()=>0.5});
 assert.deepEqual(ids,["b"]);
});
test("only selects eligible input candidates",()=>{
 const ids=chooseAdaptiveQuestions({questions:q("published"),mastery:[{questionId:"archived",timesSeen:9,timesCorrect:0,nextDueAt:"2020-01-01"}],count:1});
 assert.deepEqual(ids,["published"]);
});
test("rejects oversized quizzes",()=>assert.throws(()=>chooseAdaptiveQuestions({questions:q("a"),mastery:[],count:2}),RangeError));
test("exploration chooses an unseen item for larger quizzes",()=>{
 const questions=q("a","b","c","d","e","f","g","h","i","j");
 const mastery=questions.slice(0,9).map(({id})=>({questionId:id,timesSeen:9,timesCorrect:0,nextDueAt:"2020-01-01"}));
 const ids=chooseAdaptiveQuestions({questions,mastery,count:5,random:()=>0.5});
 assert.equal(ids.length,5);
 assert.equal(ids.includes("j"),true);
});
