import { eq, sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { dailyTransactions } from "./daily-transactions";

/**
 * Per-site monthly cost rollup — one row per (project, location, month) with the
 * summed cost and transaction count, derived from the generic daily_transactions
 * table (kind = "cost"). There is deliberately no project-named cost table; the
 * same config-driven model serves every project (PHKT included). Backs the cost
 * dashboards/trends without a separate write path.
 */
export const costByMonth = pgView("cost_by_month").as((qb) =>
  qb
    .select({
      projectId: dailyTransactions.projectId,
      locationId: dailyTransactions.locationId,
      period: sql<string>`to_char(${dailyTransactions.trxDate}, 'YYYY-MM')`.as("period"),
      cost: sql<string>`coalesce(sum(${dailyTransactions.total}), 0)`.as("cost"),
      transactions: sql<number>`count(*)`.as("transactions"),
    })
    .from(dailyTransactions)
    .where(eq(dailyTransactions.kind, "cost"))
    .groupBy(
      dailyTransactions.projectId,
      dailyTransactions.locationId,
      sql`to_char(${dailyTransactions.trxDate}, 'YYYY-MM')`,
    ),
);

export type CostByMonthRow = typeof costByMonth.$inferSelect;
