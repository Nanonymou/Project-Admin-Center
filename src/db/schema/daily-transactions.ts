import { relations } from "drizzle-orm";
import { boolean, date, index, numeric, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, tenancyColumns } from "./columns";
import { masterAreas } from "./master-areas";

/** Kind of daily transaction — the same generic table serves sales and cost. */
export const dailyTransactionKind = pgEnum("daily_transaction_kind", ["sales", "cost"]);

/** Daily closing workflow status. */
export const dailyTransactionStatus = pgEnum("daily_transaction_status", [
  "draft",
  "submitted",
  "approved",
  "locked",
]);

/**
 * Generic daily transaction header. No project-specific columns — service /
 * cost categories live in the line items, keyed by category_key that maps to
 * the project's configuration.
 */
export const dailyTransactions = pgTable(
  "daily_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    kind: dailyTransactionKind("kind").notNull(),
    trxDate: date("trx_date").notNull(),
    // Free-text area label (kept for display / mock data); `areaId` links to the
    // master_areas row when the entry is created against a managed area.
    area: varchar("area", { length: 128 }),
    areaId: uuid("area_id").references(() => masterAreas.id, { onDelete: "set null" }),
    status: dailyTransactionStatus("status").default("draft").notNull(),
    subtotal: numeric("subtotal", { precision: 18, scale: 2 }).default("0").notNull(),
    tax: numeric("tax", { precision: 18, scale: 2 }).default("0").notNull(),
    total: numeric("total", { precision: 18, scale: 2 }).default("0").notNull(),
    // Submission workflow tracking — who submitted/approved and when. `isLate`
    // flags a submission that missed the H+1 input rule (computed at submit
    // time from the project's cut-off config).
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedBy: varchar("submitted_by", { length: 128 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: varchar("approved_by", { length: 128 }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    isLate: boolean("is_late").default(false).notNull(),
    ...auditColumns,
  },
  (t) => ({
    tenantIdx: index("daily_tx_tenant_idx").on(t.projectId, t.locationId),
    dateIdx: index("daily_tx_date_idx").on(t.trxDate),
    kindIdx: index("daily_tx_kind_idx").on(t.kind),
    // Serves the KPI Utama Site aggregation: sales/cost per site over a period.
    kpiIdx: index("daily_tx_kpi_idx").on(t.projectId, t.locationId, t.kind, t.trxDate),
  }),
);

/**
 * Per-category line items for a daily transaction. category_key references the
 * config-driven category (e.g. "meals_buffet"); is_deduction marks lines like
 * Backcharge that reduce the daily total.
 */
export const dailyTransactionLines = pgTable(
  "daily_transaction_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => dailyTransactions.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    categoryKey: varchar("category_key", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    qty: numeric("qty", { precision: 18, scale: 3 }).default("0").notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).default("0").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).default("0").notNull(),
    isDeduction: boolean("is_deduction").default(false).notNull(),
  },
  (t) => ({
    txIdx: index("daily_tx_line_tx_idx").on(t.transactionId),
    tenantIdx: index("daily_tx_line_tenant_idx").on(t.projectId, t.locationId),
  }),
);

export const dailyTransactionsRelations = relations(dailyTransactions, ({ one, many }) => ({
  lines: many(dailyTransactionLines),
  area: one(masterAreas, {
    fields: [dailyTransactions.areaId],
    references: [masterAreas.id],
  }),
}));

export const dailyTransactionLinesRelations = relations(dailyTransactionLines, ({ one }) => ({
  transaction: one(dailyTransactions, {
    fields: [dailyTransactionLines.transactionId],
    references: [dailyTransactions.id],
  }),
}));

export type DailyTransaction = typeof dailyTransactions.$inferSelect;
export type NewDailyTransaction = typeof dailyTransactions.$inferInsert;
export type DailyTransactionLine = typeof dailyTransactionLines.$inferSelect;
export type NewDailyTransactionLine = typeof dailyTransactionLines.$inferInsert;
