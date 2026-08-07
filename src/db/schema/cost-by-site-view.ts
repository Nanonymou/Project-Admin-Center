import { and, eq, sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { dailyTransactionLines } from "./daily-transactions";
import { dailyTransactions } from "./daily-transactions";

/**
 * Per-site cost model — aggregates cost line items (headers of kind "cost") into
 * one row per (project, location, category), so the Cost Comparison chart can
 * read each site's cost composition directly. Derived from the same generic
 * daily_transactions data as everything else; no separate cost table and no
 * project-specific columns. Amount is the summed line amount per category.
 */
export const costBySite = pgView("cost_by_site").as((qb) =>
  qb
    .select({
      projectId: dailyTransactionLines.projectId,
      locationId: dailyTransactionLines.locationId,
      categoryKey: dailyTransactionLines.categoryKey,
      label: sql<string>`max(${dailyTransactionLines.label})`.as("label"),
      amount: sql<string>`coalesce(sum(${dailyTransactionLines.amount}), 0)`.as("amount"),
    })
    .from(dailyTransactionLines)
    .innerJoin(
      dailyTransactions,
      and(
        eq(dailyTransactionLines.transactionId, dailyTransactions.id),
        eq(dailyTransactions.kind, "cost"),
      ),
    )
    .groupBy(
      dailyTransactionLines.projectId,
      dailyTransactionLines.locationId,
      dailyTransactionLines.categoryKey,
    ),
);

export type CostBySiteRow = typeof costBySite.$inferSelect;
