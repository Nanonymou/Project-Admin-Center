import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { dailyTransactions } from "./daily-transactions";

/**
 * Per-site daily margin view — aggregates the generic daily_transactions table
 * into one row per (project, location, date) carrying sales, cost, and margin.
 * Backs the Dashboard Margin page without a separate write path: the same
 * transactions that feed KPIs are rolled up here. Kept config-agnostic (no
 * project-specific columns); margin = sales − cost.
 */
export const dailyMarginBySite = pgView("daily_margin_by_site").as((qb) =>
  qb
    .select({
      projectId: dailyTransactions.projectId,
      locationId: dailyTransactions.locationId,
      trxDate: dailyTransactions.trxDate,
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
    .groupBy(dailyTransactions.projectId, dailyTransactions.locationId, dailyTransactions.trxDate),
);

export type DailyMarginRow = typeof dailyMarginBySite.$inferSelect;
