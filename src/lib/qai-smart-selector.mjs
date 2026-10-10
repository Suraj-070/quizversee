/**
 * QAI Phase 1: pure, dependency-free question ranking.
 * Uses existing QuestionMastery fields; does not require a database migration.
 * Difficulty remains neutral until an approved calibrated question field exists.
 */
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const finite = (x, fallback = 0) => Number.isFinite(x) ? x : fallback;

/**
 * @typedef {{id:string}} Candidate
 * @typedef {{questionId:string,timesSeen:number,timesCorrect:number,nextDueAt:Date|string|null,lastSeenAt?:Date|string|null}} Mastery
 */
/**
 * @param {{questions: Candidate[],mastery:Mastery[],count:number,now?:Date,random?:()=>number,recentIds?:string[]}} options
 * @returns {string[]} Question IDs, best-first with bounded exploration and no duplicates.
 */
export function chooseAdaptiveQuestions({questions, mastery, count, now = new Date(), random = Math.random, recentIds = []}) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError("count must be a nonnegative integer");
  const unique = [...new Map(questions.map(q=>[q.id,q])).values()];
  if (count > unique.length) throw new RangeError("Not enough eligible questions");
  const byId = new Map(mastery.map(m=>[m.questionId,m]));
  const recent = new Set(recentIds);
  const time = now.getTime();
  const ranked = unique.map(q=>{
    const m = byId.get(q.id);
    const seen = Math.max(0, finite(m?.timesSeen ?? 0));
    const correct = clamp(finite(m?.timesCorrect ?? 0),0,seen);
    // Beta(1,1) prior avoids declaring mastery from one correct answer.
    const weakness = 1 - (correct + 1)/(seen + 2);
    const dueMs = m?.nextDueAt == null ? NaN : new Date(m.nextDueAt).getTime();
    const daysOverdue = (time - dueMs)/86_400_000;
    const review = !m || !Number.isFinite(daysOverdue) ? 0.5 : clamp((daysOverdue + 1)/8);
    const novelty = 1/Math.sqrt(seen + 1);
    const recentPenalty = recent.has(q.id) ? 0.28 : 0;
    const jitter = clamp(finite(random(),0.5))*0.08;
    const score = 0.35*weakness + 0.25*review + 0.20*0.5 + 0.20*novelty - recentPenalty + jitter;
    return {id:q.id,score,seen};
  });
  ranked.sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
  // Keep a small exploration quota so the learner isn't trapped in old weak items.
  const exploreCount = count >= 5 ? Math.max(1,Math.floor(count*0.2)) : 0;
  const exploitCount = count - exploreCount;
  const chosen = ranked.slice(0,exploitCount).map(q=>q.id);
  const selected = new Set(chosen);
  const exploratory = ranked.filter(q=>!selected.has(q.id)).sort((a,b)=>a.seen-b.seen || b.score-a.score || a.id.localeCompare(b.id));
  for(const q of exploratory.slice(0,exploreCount)) { chosen.push(q.id);selected.add(q.id); }
  return chosen;
}
