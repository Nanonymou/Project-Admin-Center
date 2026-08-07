import { and, eq, sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { dailyTransactionLines, dailyTransactions } from "./daily-transactions";

/**
 * Per-site sales model — aggregates sales line items (headers of kind "sales")
 * into one row per (project, location, category), mirroring cost_by_site. Reads
 * from the same generic daily_transactions data; no separate sales table and no
 * project-specific columns. Amount is the summed line amount per category (a
 * deduction line stays positive here; net handling is done in the query layer).
 */
export const salesBySite = pgView("sales_by_site").as((qb) =>
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
        eq(dailyTransactions.kind, "sales"),
      ),
    )
    .groupBy(
      dailyTransactionLines.projectId,
      dailyTransactionLines.locationId,
      dailyTransactionLines.categoryKey,
    ),
);

export type SalesBySiteRow = typeof salesBySite.$inferSelect;
