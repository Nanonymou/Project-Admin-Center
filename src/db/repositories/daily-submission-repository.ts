import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  dailySubmissions,
  type DailySubmission,
  type NewDailySubmission,
} from "@/db/schema";

export type DailySubmissionFilter = {
  projectId?: string;
  locationId?: string;
  kind?: "sales" | "cost";
  status?: "draft" | "submitted" | "reviewed" | "approved" | "rejected";
  scope?: "tenant" | "executive";
  limit?: number;
};

function buildWhere(filter: DailySubmissionFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped submission queries");
    conds.push(eq(dailySubmissions.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(dailySubmissions.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(dailySubmissions.locationId, filter.locationId));
  if (filter.kind) conds.push(eq(dailySubmissions.kind, filter.kind));
  if (filter.status) conds.push(eq(dailySubmissions.status, filter.status));
  return conds.length ? and(...conds) : undefined;
}

/** List batch submissions, newest submission date first. */
export async function listDailySubmissionsBatch(
  filter: DailySubmissionFilter,
): Promise<DailySubmission[]> {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return db
    .select()
    .from(dailySubmissions)
    .where(buildWhere(filter))
    .orderBy(desc(dailySubmissions.submissionDate))
    .limit(limit);
}

export type SubmitBatchInput = {
  projectId: string;
  locationId: string;
  kind: "sales" | "cost";
  submissionDate: string;
  totalAmount: string;
  entryCount: number;
  submittedBy: string;
  note?: string;
};

/**
 * Record a batch submission and mark it submitted. There is one logical
 * submission per site/date/kind, so an existing draft for the same key is
 * transitioned rather than duplicated. Returns the submitted row.
 */
export async function submitDailyBatch(input: SubmitBatchInput): Promise<DailySubmission> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(dailySubmissions)
      .where(
        and(
          eq(dailySubmissions.projectId, input.projectId),
          eq(dailySubmissions.locationId, input.locationId),
          eq(dailySubmissions.kind, input.kind),
          eq(dailySubmissions.submissionDate, input.submissionDate),
        ),
      )
      .limit(1);

    if (existing) {
      const [row] = await tx
        .update(dailySubmissions)
        .set({
          status: "submitted",
          totalAmount: input.totalAmount,
          entryCount: input.entryCount,
          submittedBy: input.submittedBy,
          submittedAt: new Date(),
          note: input.note,
          updatedAt: new Date(),
        })
        .where(eq(dailySubmissions.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await tx
      .insert(dailySubmissions)
      .values({
        projectId: input.projectId,
        locationId: input.locationId,
        kind: input.kind,
        submissionDate: input.submissionDate,
        status: "submitted",
        totalAmount: input.totalAmount,
        entryCount: input.entryCount,
        submittedBy: input.submittedBy,
        submittedAt: new Date(),
        note: input.note,
        createdBy: input.submittedBy,
      } satisfies NewDailySubmission)
      .returning();
    return row;
  });
}
