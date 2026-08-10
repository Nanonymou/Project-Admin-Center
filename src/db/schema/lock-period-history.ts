import { index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns } from "./columns";

/** The lock action recorded in the period-lock history. */
export const lockPeriodAction = pgEnum("lock_period_action", ["lock", "unlock"]);

/**
 * Append-only history of period lock / unlock actions — the audit trail behind
 * the Kunci Periode and Unlock Period pages. `lock_periods` holds the current
 * state per period; this table records every transition (who locked/unlocked
 * which period, when, and why) so the unlock-activity view has a full history.
 * Tenant-scoped by project_id/location_id; never updated after insert.
 */
export const lockPeriodHistory = pgTable(
  "lock_period_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    periodLabel: varchar("period_label", { length: 64 }).notNull(),
    action: lockPeriodAction("action").notNull(),
    actor: varchar("actor", { length: 128 }),
    reason: varchar("reason", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("lock_period_history_tenant_idx").on(t.projectId, t.locationId),
    periodIdx: index("lock_period_history_period_idx").on(t.projectId, t.locationId, t.periodLabel),
    actionIdx: index("lock_period_history_action_idx").on(t.action),
  }),
);

export type LockPeriodHistory = typeof lockPeriodHistory.$inferSelect;
export type NewLockPeriodHistory = typeof lockPeriodHistory.$inferInsert;
