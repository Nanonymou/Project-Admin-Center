import { timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Multi-tenancy columns — every data row carries project_id and location_id.
 * Queries must always filter by project (except the Executive Dashboard).
 */
export const tenancyColumns = {
  projectId: varchar("project_id", { length: 32 }).notNull(),
  locationId: varchar("location_id", { length: 64 }).notNull(),
};

/** Standard audit columns shared across tables. */
export const auditColumns = {
  createdBy: varchar("created_by", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

/**
 * Soft-delete columns — `deleted_at` marks a row as recycled (kept for the
 * Recycle Bin) instead of hard-deleting it; `deleted_by` records who did it.
 * A null `deleted_at` means the row is live. Queries must filter out soft-deleted
 * rows unless explicitly listing the recycle bin.
 */
export const softDeleteColumns = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: varchar("deleted_by", { length: 128 }),
};
