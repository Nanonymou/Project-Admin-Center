import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { dailyTransactions } from "./daily-transactions";

/**
 * Project-level performance rollup — one row per project with total sales, cost,
 * margin, and the number of contributing sites, derived from the generic
 * daily_transactions table. Backs the Project Performance dashboard's cross-site
 * project comparison. No project-named columns; margin = sales − cost.
 */
export const projectPerformance = pgView("project_performance").as((qb) =>
  qb
    .select({
      projectId: dailyTransactions.projectId,
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
      siteCount: sql<number>`count(distinct ${dailyTransactions.locationId})`.as("site_count"),
    })
    .from(dailyTransactions)
    .groupBy(dailyTransactions.projectId),
);

export type ProjectPerformanceRow = typeof projectPerformance.$inferSelect;
