import { boolean, date, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, tenancyColumns } from "./columns";

/**
 * Period locks — one row per site per invoice period recording whether that
 * period is locked (closed for further edits). Tenant-scoped by
 * project_id/location_id. When `locked` is true, submissions for the period are
 * frozen; unlocking (see the daily-cost unlock flow) clears it. The period is
 * identified by a config-driven label plus its start/end bounds.
 */
export const lockPeriods = pgTable(
  "lock_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    periodLabel: varchar("period_label", { length: 64 }).notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    locked: boolean("locked").default(false).notNull(),
    lockedBy: varchar("locked_by", { length: 128 }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    reason: varchar("reason", { length: 512 }),
    ...auditColumns,
  },
  (t) => ({
    periodIdx: uniqueIndex("lock_periods_period_idx").on(t.projectId, t.locationId, t.periodLabel),
    tenantIdx: index("lock_periods_tenant_idx").on(t.projectId, t.locationId),
    lockedIdx: index("lock_periods_locked_idx").on(t.locked),
  }),
);

export type LockPeriod = typeof lockPeriods.$inferSelect;
export type NewLockPeriod = typeof lockPeriods.$inferInsert;
