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
