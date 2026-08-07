import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { allAttachments, type AllAttachmentRow } from "@/db/schema";

export type AttachmentCenterFilter = {
  projectId?: string;
  locationId?: string;
  source?: string; // "invoice" | "transaction"
  category?: string;
  limit?: number;
  scope?: "tenant" | "executive";
};

/**
 * List attachments from the unified all_attachments view, newest first.
 * Tenant-scoped: a tenant query requires a projectId. Repository Pattern: all DB
 * access to the unified attachment feed flows through this module.
 */
export async function listAllAttachments(filter: AttachmentCenterFilter): Promise<AllAttachmentRow[]> {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped attachment queries");
    conds.push(eq(allAttachments.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(allAttachments.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(allAttachments.locationId, filter.locationId));
  if (filter.source) conds.push(eq(allAttachments.source, filter.source));
  if (filter.category) conds.push(eq(allAttachments.category, filter.category));

  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return db
    .select()
    .from(allAttachments)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(allAttachments.createdAt))
    .limit(limit);
}
