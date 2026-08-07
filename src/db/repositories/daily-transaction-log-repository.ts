import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { dailyTransactionLogs, type DailyTransactionLog } from "@/db/schema";

export type LogFilter = {
  transactionId?: string;
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  limit?: number;
  scope?: "tenant" | "executive";
};

function buildWhere(filter: LogFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.transactionId) conds.push(eq(dailyTransactionLogs.transactionId, filter.transactionId));
  // Multi-tenancy: a site-scoped query without a project (and without a specific
  // transaction) must not run, matching the other repositories.
  if (filter.scope !== "executive" && !filter.transactionId) {
    if (!filter.projectId) {
      throw new Error("projectId is required for tenant-scoped log queries");
    }
    conds.push(eq(dailyTransactionLogs.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(dailyTransactionLogs.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(dailyTransactionLogs.locationId, filter.locationId));
  return conds.length ? and(...conds) : undefined;
}

/**
 * List daily-transaction change-log entries, newest first — for a single
 * transaction's history or a site's recent changes. Repository Pattern: all DB
 * access to the daily_transaction_logs table flows through this module.
 */
export async function listDailyTransactionLogs(filter: LogFilter): Promise<DailyTransactionLog[]> {
  const where = buildWhere(filter);
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return db
    .select()
    .from(dailyTransactionLogs)
    .where(where)
    .orderBy(desc(dailyTransactionLogs.createdAt))
    .limit(limit);
}
