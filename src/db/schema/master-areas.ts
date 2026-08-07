import { boolean, index, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns, tenancyColumns } from "./columns";

/**
 * Master sales areas (sub-locations) — one row per serviceable area at a site
 * (mess halls, camps, offices). Tenant-scoped by project_id/location_id. A Daily
 * Sales entry references an area by `area_code`; the config-driven engine reads
 * areas from this table so a site's area list can be maintained per location
 * without project-named columns.
 */
export const masterAreas = pgTable(
  "master_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ...tenancyColumns,
    areaCode: varchar("area_code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    codeIdx: uniqueIndex("master_areas_code_idx").on(t.projectId, t.locationId, t.areaCode),
    tenantIdx: index("master_areas_tenant_idx").on(t.projectId, t.locationId),
  }),
);

export type MasterArea = typeof masterAreas.$inferSelect;
export type NewMasterArea = typeof masterAreas.$inferInsert;
