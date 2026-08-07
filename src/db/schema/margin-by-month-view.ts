import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { dailyTransactions } from "./daily-transactions";

/**
 * Per-site monthly margin rollup — one row per (project, location, month) with
 * sales, cost, and margin, derived from the generic daily_transactions table.
 * Backs the Margin Dashboard trends (every project, PHKT included) without a
 * project-named table; margin = sales − cost.
 */
export const marginByMonth = pgView("margin_by_month").as((qb) =>
  qb
    .select({
      projectId: dailyTransactions.projectId,
      locationId: dailyTransactions.locationId,
      period: sql<string>`to_char(${dailyTransactions.trxDate}, 'YYYY-MM')`.as("period"),
      sales:
        sql<string>`coalesce(sum(case when ${dailyTransactions.kind} = 'sales' then ${dailyTransactions.total} else 0 end), 0)`.as(
          "sales",
        ),
      cost:
        sql<string>`coalesce(sum(case when ${dailyTransactions.kind} = 'cost' then ${dailyTransactions.total} else 0 end), 0)`.as(
          "cost",
        ),
      margin:
        sql<string>`coalesce(sum(case when ${dailyTransactions.kind} = 'sales' then ${dailyTransactions.total} else -${dailyTransactions.total} end), 0)`.as(
          "margin",
        ),
    })
    .from(dailyTransactions)
    .groupBy(
      dailyTransactions.projectId,
      dailyTransactions.locationId,
      sql`to_char(${dailyTransactions.trxDate}, 'YYYY-MM')`,
    ),
);

export type MarginByMonthRow = typeof marginByMonth.$inferSelect;
