/** PostgreSQL serialization errors from Prisma transactions and raw SQL. */
export function isRetryableTransactionError(error) {
  if (!error || typeof error !== "object") return false;
  if (error.code === "P2034") return true;
  // $queryRaw wraps PostgreSQL SQLSTATE 40001 (serialization failure)
  // and 40P01 (deadlock detected) as P2010.
  return error.code === "P2010" &&
    (error.meta?.code === "40001" || error.meta?.code === "40P01");
}
