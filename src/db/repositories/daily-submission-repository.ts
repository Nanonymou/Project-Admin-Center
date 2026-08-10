import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  dailySubmissions,
  dailySubmissionHistory,
  type DailySubmission,
  type DailySubmissionHistory,
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

export type SubmissionAction = "submit" | "review" | "approve" | "reject" | "resubmit";
type SubmissionStatus = "draft" | "submitted" | "reviewed" | "approved" | "rejected";

/** Allowed status transitions per action; the target status each action moves to. */
const TRANSITIONS: Record<SubmissionAction, { from: SubmissionStatus[]; to: SubmissionStatus }> = {
  submit: { from: ["draft"], to: "submitted" },
  review: { from: ["submitted"], to: "reviewed" },
  approve: { from: ["submitted", "reviewed"], to: "approved" },
  reject: { from: ["submitted", "reviewed"], to: "rejected" },
  resubmit: { from: ["rejected"], to: "submitted" },
};

export type TransitionResult =
  | { ok: true; submission: DailySubmission }
  | { ok: false; status: number; message: string };

/**
 * Apply an approval action to a submission, validating the transition against
 * its current status, updating the status, and appending an approval-history
 * row — all in one transaction. Returns a typed result the route maps to HTTP.
 */
export async function transitionDailySubmission(
  id: string,
  action: SubmissionAction,
  actor: string,
  reason?: string,
): Promise<TransitionResult> {
  const spec = TRANSITIONS[action];
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(dailySubmissions)
      .where(eq(dailySubmissions.id, id))
      .limit(1);
    if (!current) return { ok: false as const, status: 404, message: "Pengajuan tidak ditemukan." };
    if (!spec.from.includes(current.status as SubmissionStatus)) {
      return {
        ok: false as const,
        status: 409,
        message: `Aksi "${action}" tidak valid dari status "${current.status}".`,
      };
    }

    const isReview = action === "review" || action === "approve" || action === "reject";
    const [updated] = await tx
      .update(dailySubmissions)
      .set({
        status: spec.to,
        reviewedBy: isReview ? actor : current.reviewedBy,
        reviewedAt: isReview ? new Date() : current.reviewedAt,
        note: reason ?? current.note,
        updatedAt: new Date(),
      })
      .where(eq(dailySubmissions.id, id))
      .returning();

    await tx.insert(dailySubmissionHistory).values({
      submissionId: id,
      projectId: current.projectId,
      locationId: current.locationId,
      action,
      fromStatus: current.status,
      toStatus: spec.to,
      actor,
      reason,
    });

    return { ok: true as const, submission: updated };
  });
}

/** Fetch one batch submission by id. */
export async function getDailySubmissionById(id: string): Promise<DailySubmission | null> {
  const [row] = await db.select().from(dailySubmissions).where(eq(dailySubmissions.id, id)).limit(1);
  return row ?? null;
}

/** List a submission's approval history, newest first. */
export async function listDailySubmissionHistory(
  submissionId: string,
): Promise<DailySubmissionHistory[]> {
  return db
    .select()
    .from(dailySubmissionHistory)
    .where(eq(dailySubmissionHistory.submissionId, submissionId))
    .orderBy(desc(dailySubmissionHistory.createdAt));
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

    let row: DailySubmission;
    let fromStatus: string | null;
    if (existing) {
      fromStatus = existing.status;
      [row] = await tx
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
    } else {
      fromStatus = null;
      [row] = await tx
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
    }

    // Auto-record the submit action on the approval history.
    await tx.insert(dailySubmissionHistory).values({
      submissionId: row.id,
      projectId: input.projectId,
      locationId: input.locationId,
      action: "submit",
      fromStatus,
      toStatus: "submitted",
      actor: input.submittedBy,
      reason: input.note,
    });

    return row;
  });
}
