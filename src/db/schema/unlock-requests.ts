import { index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns } from "./columns";

/** Review lifecycle of an unlock request. */
export const unlockRequestStatus = pgEnum("unlock_request_status", ["pending", "approved", "rejected"]);

/**
 * Unlock requests — the request/approval workflow behind the Unlock Period page.
 * A Site Admin requests that a locked period be reopened (with a reason); a
 * Leader/Super Admin approves or rejects it. Approving drives the actual unlock
 * (see the lock-period flow); the request row preserves who asked, who decided,
 * and why. Tenant-scoped by project_id/location_id and keyed to a period label.
 */
export const unlockRequests = pgTable(
  "unlock_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    periodLabel: varchar("period_label", { length: 64 }).notNull(),
    status: unlockRequestStatus("status").default("pending").notNull(),
    requestedBy: varchar("requested_by", { length: 128 }),
    reason: varchar("reason", { length: 512 }),
    reviewedBy: varchar("reviewed_by", { length: 128 }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: varchar("review_note", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("unlock_requests_tenant_idx").on(t.projectId, t.locationId),
    statusIdx: index("unlock_requests_status_idx").on(t.status),
    periodIdx: index("unlock_requests_period_idx").on(t.projectId, t.locationId, t.periodLabel),
  }),
);

export type UnlockRequest = typeof unlockRequests.$inferSelect;
export type NewUnlockRequest = typeof unlockRequests.$inferInsert;
