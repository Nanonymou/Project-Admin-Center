import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { approvals } from "./approvals";

/**
 * Per-site approval rollup — one row per (project, location, subject type,
 * current stage, status) with the count of approvals in that bucket. Derived
 * from the generic approvals table (no project-named approval table; the same
 * model serves every project, PHKT included). Backs the approval dashboards.
 */
export const approvalBySite = pgView("approval_by_site").as((qb) =>
  qb
    .select({
      projectId: approvals.projectId,
      locationId: approvals.locationId,
      subjectType: approvals.subjectType,
      currentStage: approvals.currentStage,
      status: approvals.status,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(approvals)
    .groupBy(
      approvals.projectId,
      approvals.locationId,
      approvals.subjectType,
      approvals.currentStage,
      approvals.status,
    ),
);

export type ApprovalBySiteRow = typeof approvalBySite.$inferSelect;
