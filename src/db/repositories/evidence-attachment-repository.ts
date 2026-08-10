import { and, desc, eq, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  evidenceAttachments,
  type EvidenceAttachment,
  type NewEvidenceAttachment,
} from "@/db/schema";

export type EvidenceFilter = {
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  kind?: string;
  status?: "pending" | "verified" | "rejected";
  scope?: "tenant" | "executive";
  limit?: number;
};

/** Tenant-safe WHERE builder — throws for a tenant query without a projectId. */
function buildWhere(filter: EvidenceFilter): SQL | undefined {
  const conds: SQL[] = [isNull(evidenceAttachments.deletedAt)];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped evidence queries");
    conds.push(eq(evidenceAttachments.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(evidenceAttachments.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(evidenceAttachments.locationId, filter.locationId));
  if (filter.kind) conds.push(eq(evidenceAttachments.kind, filter.kind));
  if (filter.status) conds.push(eq(evidenceAttachments.status, filter.status));
  return and(...conds);
}

/** List evidence attachments (excludes soft-deleted), newest upload first. */
export async function listEvidence(filter: EvidenceFilter): Promise<EvidenceAttachment[]> {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return db
    .select()
    .from(evidenceAttachments)
    .where(buildWhere(filter))
    .orderBy(desc(evidenceAttachments.uploadedAt))
    .limit(limit);
}

/** Record an uploaded evidence attachment. Returns the created row. */
export async function createEvidence(values: NewEvidenceAttachment): Promise<EvidenceAttachment> {
  const [row] = await db.insert(evidenceAttachments).values(values).returning();
  return row;
}

/** Update an evidence attachment's review status. Tenant-scoped by projectId. */
export async function setEvidenceStatus(
  id: string,
  projectId: string,
  status: "pending" | "verified" | "rejected",
  actor: string,
  note?: string,
): Promise<EvidenceAttachment | null> {
  const [row] = await db
    .update(evidenceAttachments)
    .set({ status, note, updatedAt: new Date() })
    .where(
      and(
        eq(evidenceAttachments.id, id),
        eq(evidenceAttachments.projectId, projectId),
        isNull(evidenceAttachments.deletedAt),
      ),
    )
    .returning();
  return row ?? null;
}

/** Soft-delete an evidence attachment (moves it to the recycle bin). */
export async function softDeleteEvidence(
  id: string,
  projectId: string,
  actor: string,
): Promise<boolean> {
  const [row] = await db
    .update(evidenceAttachments)
    .set({ deletedAt: new Date(), deletedBy: actor })
    .where(
      and(
        eq(evidenceAttachments.id, id),
        eq(evidenceAttachments.projectId, projectId),
        isNull(evidenceAttachments.deletedAt),
      ),
    )
    .returning();
  return Boolean(row);
}
