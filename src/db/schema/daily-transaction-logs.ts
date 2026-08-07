import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns } from "./columns";
import { dailyTransactions } from "./daily-transactions";

/**
 * Events recorded on a daily transaction's change log. The same generic log
 * serves daily sales and daily cost — no project- or kind-specific variants.
 */
export const dailyTransactionLogAction = pgEnum("daily_transaction_log_action", [
  "create",
  "edit",
  "submit",
  "approve",
  "reject",
  "lock",
  "unlock",
]);

/**
 * Append-only change log for daily transactions — one row per action taken on a
 * sales or cost entry (created, edited, submitted, approved, locked, unlocked).
 * Tenant-scoped by project_id/location_id and linked to the transaction by FK.
 * Never updated after insert; ordered by created_at when rendered as a log.
 */
export const dailyTransactionLogs = pgTable(
  "daily_transaction_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => dailyTransactions.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    action: dailyTransactionLogAction("action").notNull(),
    actor: varchar("actor", { length: 128 }).notNull(),
    fromStatus: varchar("from_status", { length: 32 }),
    toStatus: varchar("to_status", { length: 32 }),
    detail: varchar("detail", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    txIdx: index("daily_tx_log_tx_idx").on(t.transactionId),
    tenantIdx: index("daily_tx_log_tenant_idx").on(t.projectId, t.locationId),
    createdIdx: index("daily_tx_log_created_idx").on(t.createdAt),
    actionIdx: index("daily_tx_log_action_idx").on(t.action),
  }),
);

export const dailyTransactionLogsRelations = relations(dailyTransactionLogs, ({ one }) => ({
  transaction: one(dailyTransactions, {
    fields: [dailyTransactionLogs.transactionId],
    references: [dailyTransactions.id],
  }),
}));

export type DailyTransactionLog = typeof dailyTransactionLogs.$inferSelect;
export type NewDailyTransactionLog = typeof dailyTransactionLogs.$inferInsert;
