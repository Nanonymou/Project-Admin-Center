import { relations } from "drizzle-orm";
import { date, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, tenancyColumns } from "./columns";

/** Lifecycle status of a managed period. */
export const periodStatus = pgEnum("period_status", ["open", "closing", "closed", "locked"]);

/** Action recorded on the period history log. */
export const periodAction = pgEnum("period_action", [
  "open",
  "start_closing",
  "close",
  "lock",
  "unlock",
  "reopen",
  "set_cutoff",
]);

/**
 * Managed periods — one row per site per invoice period, tracking the period
 * window (derived from the project's cut-off config) and its lifecycle status.
 * Tenant-scoped by project_id/location_id. `period_type` records which cut-off
 * rule produced the window (config-driven; no project-named columns).
 */
export const periods = pgTable(
  "periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    periodLabel: varchar("period_label", { length: 64 }).notNull(),
    periodType: varchar("period_type", { length: 16 }),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    status: periodStatus("status").default("open").notNull(),
    ...auditColumns,
  },
  (t) => ({
    periodIdx: uniqueIndex("periods_period_idx").on(t.projectId, t.locationId, t.periodLabel),
    tenantIdx: index("periods_tenant_idx").on(t.projectId, t.locationId),
    statusIdx: index("periods_status_idx").on(t.status),
  }),
);

/**
 * Append-only period history — one row per lifecycle action on a period, so the
 * full audit trail of who opened / closed / locked / reopened it is preserved.
 */
export const periodHistory = pgTable(
  "period_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    periodId: uuid("period_id")
      .notNull()
      .references(() => periods.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    action: periodAction("action").notNull(),
    actor: varchar("actor", { length: 128 }).notNull(),
    note: varchar("note", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodIdx: index("period_history_period_idx").on(t.periodId),
    tenantIdx: index("period_history_tenant_idx").on(t.projectId, t.locationId),
    createdIdx: index("period_history_created_idx").on(t.createdAt),
  }),
);

export const periodsRelations = relations(periods, ({ many }) => ({
  history: many(periodHistory),
}));

export const periodHistoryRelations = relations(periodHistory, ({ one }) => ({
  period: one(periods, {
    fields: [periodHistory.periodId],
    references: [periods.id],
  }),
}));

export type Period = typeof periods.$inferSelect;
export type NewPeriod = typeof periods.$inferInsert;
export type PeriodHistoryEntry = typeof periodHistory.$inferSelect;
export type NewPeriodHistoryEntry = typeof periodHistory.$inferInsert;
