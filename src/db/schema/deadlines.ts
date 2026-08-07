import { date, index, integer, pgEnum, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, tenancyColumns } from "./columns";

/** Category of a calendar deadline. */
export const deadlineKind = pgEnum("deadline_kind", [
  "closing",
  "invoice_submit",
  "approval",
  "payment",
  "audit",
]);

/** Derived urgency status of a deadline relative to today. */
export const deadlineStatus = pgEnum("deadline_status", [
  "on_track",
  "due_soon",
  "due_today",
  "overdue",
  "settled",
]);

/**
 * Deadline calendar entry — one row per dated obligation (closing, invoice
 * submission, approval, payment, audit) for a site. Tenant-scoped by
 * project_id/location_id. Status is a stored snapshot; readers may recompute it
 * from due_date when rendering the calendar.
 */
export const deadlines = pgTable(
  "deadlines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    kind: deadlineKind("kind").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    target: varchar("target", { length: 160 }),
    owner: varchar("owner", { length: 128 }),
    dueDate: date("due_date").notNull(),
    status: deadlineStatus("status").default("on_track").notNull(),
    progressPct: integer("progress_pct").default(0).notNull(),
    ...auditColumns,
  },
  (t) => ({
    tenantIdx: index("deadlines_tenant_idx").on(t.projectId, t.locationId),
    dueIdx: index("deadlines_due_idx").on(t.dueDate),
    kindIdx: index("deadlines_kind_idx").on(t.kind),
    statusIdx: index("deadlines_status_idx").on(t.status),
  }),
);

export type Deadline = typeof deadlines.$inferSelect;
export type NewDeadline = typeof deadlines.$inferInsert;
