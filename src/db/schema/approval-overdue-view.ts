import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";
import { approvals } from "./approvals";

/**
 * Per-site overdue-approval rollup — one row per (project, location) with the
 * count of in-progress approvals and the subset that is overdue (past its due
 * date and not completed). Derived from the generic approvals table; no
 * project-named table (serves every project, PHKT included). Backs the approval
 * monitoring dashboards' urgency indicators.
 */
export const approvalOverdueBySite = pgView("approval_overdue_by_site").as((qb) =>
  qb
    .select({
      projectId: approvals.projectId,
      locationId: approvals.locationId,
      inProgress: sql<number>`count(*) filter (where ${approvals.status} <> 'completed')`.as("in_progress"),
      overdue:
        sql<number>`count(*) filter (where ${approvals.status} <> 'completed' and ${approvals.dueDate} < current_date)`.as(
          "overdue",
        ),
    })
    .from(approvals)
    .groupBy(approvals.projectId, approvals.locationId),
);

export type ApprovalOverdueBySiteRow = typeof approvalOverdueBySite.$inferSelect;
