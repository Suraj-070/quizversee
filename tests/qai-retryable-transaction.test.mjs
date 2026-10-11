import test from "node:test";
import assert from "node:assert/strict";
import { isRetryableTransactionError } from "../src/lib/qai-retryable-transaction.mjs";
test("PostgreSQL raw query serialization and deadlock errors are retried", () => {
  assert.equal(isRetryableTransactionError({ code: "P2010", meta: { code: "40001" } }), true);
  assert.equal(isRetryableTransactionError({ code: "P2010", meta: { code: "40P01" } }), true);
  assert.equal(isRetryableTransactionError({ code: "P2034" }), true);
});
test("non transient SQL errors are never retried", () => {
  assert.equal(isRetryableTransactionError({ code: "P2010", meta: { code: "23505" } }), false);
  assert.equal(isRetryableTransactionError({ code: "P2025" }), false);
  assert.equal(isRetryableTransactionError(null), false);
});
