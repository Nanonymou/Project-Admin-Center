import { index, integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Direction of a data-transfer job. */
export const importExportDirection = pgEnum("import_export_direction", ["import", "export"]);

/** Status of an import/export job. */
export const importExportStatus = pgEnum("import_export_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

/**
 * Import/Export job history — one row per import or export operation (master
 * data, daily transactions, invoices, …). `project_id` is set when the job is
 * scoped to one project. Records row counts and outcome for the Import/Export
 * Engine's history view.
 */
export const importExportJobs = pgTable(
  "import_export_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    direction: importExportDirection("direction").notNull(),
    entity: varchar("entity", { length: 48 }).notNull(),
    projectId: varchar("project_id", { length: 32 }),
    format: varchar("format", { length: 16 }).default("csv").notNull(),
    status: importExportStatus("status").default("pending").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    processedRows: integer("processed_rows").default(0).notNull(),
    failedRows: integer("failed_rows").default(0).notNull(),
    actor: varchar("actor", { length: 128 }),
    detail: varchar("detail", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    directionIdx: index("import_export_jobs_direction_idx").on(t.direction),
    entityIdx: index("import_export_jobs_entity_idx").on(t.entity),
    projectIdx: index("import_export_jobs_project_idx").on(t.projectId),
    createdIdx: index("import_export_jobs_created_idx").on(t.createdAt),
  }),
);

export type ImportExportJob = typeof importExportJobs.$inferSelect;
export type NewImportExportJob = typeof importExportJobs.$inferInsert;
