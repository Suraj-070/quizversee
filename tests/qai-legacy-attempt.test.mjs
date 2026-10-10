import test from "node:test";
import assert from "node:assert/strict";
import { isLegacyAttempt } from "../src/lib/qai-legacy-attempt.mjs";
test("pre-activation attempt requires restart",()=>assert.equal(isLegacyAttempt("2026-10-10T00:00:00Z","2026-10-11T00:00:00Z"),true));
test("new attempt is eligible",()=>assert.equal(isLegacyAttempt("2026-10-11T00:00:01Z","2026-10-11T00:00:00Z"),false));
test("missing activation timestamp cannot silently admit legacy attempts",()=>assert.throws(()=>isLegacyAttempt(new Date(),undefined)));
