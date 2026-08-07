import { eq, sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { dailyTransactions } from "./daily-transactions";

/**
 * Per-area cost rollup — one row per (project, location, area) with the summed
 * cost and transaction count, from the generic daily_transactions table
 * (kind = "cost"). Rows without an area bucket under "(Tanpa Area)". No
 * project-named cost table; the same model serves every project (PHSS included).
 */
export const costByArea = pgView("cost_by_area").as((qb) =>
  qb
    .select({
      projectId: dailyTransactions.projectId,
      locationId: dailyTransactions.locationId,
      area: sql<string>`coalesce(${dailyTransactions.area}, '(Tanpa Area)')`.as("area"),
      cost: sql<string>`coalesce(sum(${dailyTransactions.total}), 0)`.as("cost"),
      transactions: sql<number>`count(*)`.as("transactions"),
    })
    .from(dailyTransactions)
    .where(eq(dailyTransactions.kind, "cost"))
    .groupBy(
      dailyTransactions.projectId,
      dailyTransactions.locationId,
      sql`coalesce(${dailyTransactions.area}, '(Tanpa Area)')`,
    ),
);

export type CostByAreaRow = typeof costByArea.$inferSelect;
