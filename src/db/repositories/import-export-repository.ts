import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { importExportJobs, type ImportExportJob, type NewImportExportJob } from "@/db/schema";

/** Record an import/export job. Returns the created row. */
export async function recordImportExportJob(values: NewImportExportJob): Promise<ImportExportJob> {
  const [row] = await db.insert(importExportJobs).values(values).returning();
  return row;
}

export type JobFilter = {
  direction?: "import" | "export";
  entity?: string;
  projectId?: string;
  limit?: number;
};

/** List import/export jobs, newest first. */
export async function listImportExportJobs(filter: JobFilter = {}): Promise<ImportExportJob[]> {
  const conds: SQL[] = [];
  if (filter.direction) conds.push(eq(importExportJobs.direction, filter.direction));
  if (filter.entity) conds.push(eq(importExportJobs.entity, filter.entity));
  if (filter.projectId) conds.push(eq(importExportJobs.projectId, filter.projectId));
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  return db
    .select()
    .from(importExportJobs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(importExportJobs.createdAt))
    .limit(limit);
}
