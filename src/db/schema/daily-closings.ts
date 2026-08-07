import { date, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, tenancyColumns } from "./columns";

/** Daily closing workflow status per site per day. */
export const dailyClosingStatus = pgEnum("daily_closing_status_kind", [
  "open",
  "submitted",
  "approved",
  "locked",
]);

/**
 * Daily closing status — one row per site per day, tracking the closing workflow
 * (open → submitted → approved → locked) that confirms all daily sales & cost for
 * that day are complete. Tenant-scoped by project_id/location_id. Distinct from
 * individual transaction status; this is the day-level checkpoint.
 */
export const dailyClosings = pgTable(
  "daily_closings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    closingDate: date("closing_date").notNull(),
    status: dailyClosingStatus("status").default("open").notNull(),
    submittedBy: varchar("submitted_by", { length: 128 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedBy: varchar("approved_by", { length: 128 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    note: varchar("note", { length: 512 }),
    ...auditColumns,
  },
  (t) => ({
    dayIdx: uniqueIndex("daily_closings_day_idx").on(t.projectId, t.locationId, t.closingDate),
    tenantIdx: index("daily_closings_tenant_idx").on(t.projectId, t.locationId),
    statusIdx: index("daily_closings_status_idx").on(t.status),
  }),
);

export type DailyClosing = typeof dailyClosings.$inferSelect;
export type NewDailyClosing = typeof dailyClosings.$inferInsert;
