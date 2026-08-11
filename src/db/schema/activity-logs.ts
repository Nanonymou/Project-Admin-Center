import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Activity Log (Activity Log feature) — the operational activity trail: who did
 * what on which site's data (create / edit / submit / review / approve / lock …).
 * Distinct from `audit_logs`, which records system/security & configuration
 * events; this table is the per‑site operational feed the `/activity-log` UI
 * shows. Append‑only. Keyed generically by project_code/location_id (not
 * project‑named columns) so one table serves every project.
 */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** create | edit | submit | review | approve | reject | lock | unlock | upload | send. */
    action: varchar("action", { length: 24 }).notNull(),
    actor: varchar("actor", { length: 128 }).notNull(),
    role: varchar("role", { length: 48 }).notNull().default(""),
    /** The entity acted upon, e.g. "Daily Sales BUMA/123". */
    target: varchar("target", { length: 192 }).notNull().default(""),
    projectCode: varchar("project_code", { length: 32 }),
    locationId: varchar("location_id", { length: 64 }),
    detail: varchar("detail", { length: 512 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    siteIdx: index("activity_logs_site_idx").on(t.projectCode, t.locationId),
    actorIdx: index("activity_logs_actor_idx").on(t.actor),
    createdIdx: index("activity_logs_created_idx").on(t.createdAt),
  }),
);

export type ActivityLogRow = typeof activityLogs.$inferSelect;
export type NewActivityLogRow = typeof activityLogs.$inferInsert;
