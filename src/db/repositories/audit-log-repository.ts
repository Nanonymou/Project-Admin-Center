import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, type AuditLog, type NewAuditLog } from "@/db/schema";

export type AuditLogFilter = {
  projectId?: string;
  locationId?: string;
  category?: string;
  from?: string; // created_at lower bound (YYYY-MM-DD)
  to?: string; // created_at upper bound (YYYY-MM-DD)
  limit?: number;
  scope?: "tenant" | "executive";
};

function buildWhere(filter: AuditLogFilter): SQL | undefined {
  const conds: SQL[] = [];
  // Multi-tenancy: a tenant-scoped query requires a project. System-wide rows
  // (null project) are only visible to executive-scope queries.
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped audit queries");
    conds.push(eq(auditLogs.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(auditLogs.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(auditLogs.locationId, filter.locationId));
  if (filter.category) conds.push(eq(auditLogs.category, filter.category));
  if (filter.from) conds.push(gte(auditLogs.createdAt, new Date(`${filter.from}T00:00:00Z`)));
  if (filter.to) conds.push(lte(auditLogs.createdAt, new Date(`${filter.to}T23:59:59Z`)));
  return conds.length ? and(...conds) : undefined;
}

/** List audit log entries for the filtered scope, newest first. */
export async function listAuditLogs(filter: AuditLogFilter): Promise<AuditLog[]> {
  const where = buildWhere(filter);
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

/** Record an audit log entry. */
export async function writeAuditLog(entry: NewAuditLog): Promise<void> {
  await db.insert(auditLogs).values(entry);
}
