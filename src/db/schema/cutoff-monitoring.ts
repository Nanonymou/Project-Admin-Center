import { date, index, integer, pgEnum, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, tenancyColumns } from "./columns";

/** Closing status of a site's period relative to its cut-off date. */
export const cutoffStatus = pgEnum("cutoff_status", [
  "on_track",
  "closing_soon",
  "critical",
  "locked",
]);

/** Delivery status of the invoice/package to the client. */
export const deliveryStatus = pgEnum("delivery_status", [
  "not_started",
  "in_progress",
  "sent",
  "confirmed",
]);

/**
 * Cut-off & delivery monitoring — one row per site per invoice period, tracking
 * how close the period is to its cut-off, how much has been submitted, and the
 * delivery state to the client. Tenant-scoped by project_id/location_id. The
 * cut-off date itself is derived from the project's config (§16.A); this row is a
 * monitored snapshot.
 */
export const cutoffMonitoring = pgTable(
  "cutoff_monitoring",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    periodLabel: varchar("period_label", { length: 64 }).notNull(),
    cutOffDate: date("cut_off_date"),
    status: cutoffStatus("status").default("on_track").notNull(),
    submittedPct: integer("submitted_pct").default(0).notNull(),
    delivery: deliveryStatus("delivery").default("not_started").notNull(),
    pendingInvoices: integer("pending_invoices").default(0).notNull(),
    ...auditColumns,
  },
  (t) => ({
    periodIdx: uniqueIndex("cutoff_monitoring_period_idx").on(t.projectId, t.locationId, t.periodLabel),
    tenantIdx: index("cutoff_monitoring_tenant_idx").on(t.projectId, t.locationId),
    statusIdx: index("cutoff_monitoring_status_idx").on(t.status),
  }),
);

export type CutoffMonitoring = typeof cutoffMonitoring.$inferSelect;
export type NewCutoffMonitoring = typeof cutoffMonitoring.$inferInsert;
