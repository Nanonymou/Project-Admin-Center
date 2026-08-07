import { and, asc, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalHistory,
  approvals,
  type Approval,
  type ApprovalHistoryEntry,
} from "@/db/schema";

export type ApprovalFilter = {
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  subjectType?: "invoice" | "daily_closing";
  /** "tenant" enforces a project filter; "executive" allows cross-project. */
  scope?: "tenant" | "executive";
};

function buildWhere(filter: ApprovalFilter, base?: SQL): SQL | undefined {
  const conds: SQL[] = [];
  if (base) conds.push(base);
  // Multi-tenancy: never query without a project filter unless Executive scope.
  if (filter.scope !== "executive") {
    if (!filter.projectId) {
      throw new Error("projectId is required for tenant-scoped approval queries");
    }
    conds.push(eq(approvals.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(approvals.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(approvals.locationId, filter.locationId));
  if (filter.subjectType) conds.push(eq(approvals.subjectType, filter.subjectType));
  return conds.length ? and(...conds) : undefined;
}

export type SiteApprovalProgress = {
  projectId: string;
  locationId: string;
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionPct: number;
};

/**
 * Per-site approval progress: totals, completed vs in-progress, and the overdue
 * subset (past due date and not yet completed). Repository Pattern: all DB
 * access to the approvals table flows through this module; multi-tenancy is
 * enforced in `buildWhere`.
 */
export async function aggregateApprovalProgressBySite(
  filter: ApprovalFilter,
): Promise<SiteApprovalProgress[]> {
  const where = buildWhere(filter);
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      projectId: approvals.projectId,
      locationId: approvals.locationId,
      total: count(),
      completed: sql<number>`count(*) filter (where ${approvals.status} = 'completed')`,
      overdue: sql<number>`count(*) filter (where ${approvals.status} <> 'completed' and ${approvals.dueDate} < ${today})`,
    })
    .from(approvals)
    .where(where)
    .groupBy(approvals.projectId, approvals.locationId);

  return rows.map((r) => {
    const total = Number(r.total);
    const completed = Number(r.completed);
    return {
      projectId: r.projectId,
      locationId: r.locationId,
      total,
      completed,
      inProgress: total - completed,
      overdue: Number(r.overdue),
      completionPct: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
    };
  });
}

export type StageFunnelPoint = { stage: string; count: number };

/**
 * Stage funnel across the filtered scope — how many in-progress approvals sit at
 * each stage. Completed approvals have left the funnel and are excluded.
 */
export async function aggregateApprovalStageFunnel(filter: ApprovalFilter): Promise<StageFunnelPoint[]> {
  const where = buildWhere(filter, ne(approvals.status, "completed"));

  const rows = await db
    .select({ stage: approvals.currentStage, count: count() })
    .from(approvals)
    .where(where)
    .groupBy(approvals.currentStage);

  return rows.map((r) => ({ stage: r.stage, count: Number(r.count) }));
}

export type ApprovalTimeline = {
  approval: Approval;
  history: ApprovalHistoryEntry[];
};

/**
 * Detailed approval timelines for the filtered scope — each approval (subject)
 * with its full, chronologically ordered stage history. Typically called with a
 * location filter for the per-site timeline view. History is fetched in one
 * batched query (inArray) to avoid an N+1 per approval.
 */
export async function listApprovalTimelines(filter: ApprovalFilter): Promise<ApprovalTimeline[]> {
  const where = buildWhere(filter);
  const rows = await db.select().from(approvals).where(where).orderBy(desc(approvals.updatedAt));
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const hist = await db
    .select()
    .from(approvalHistory)
    .where(inArray(approvalHistory.approvalId, ids))
    .orderBy(asc(approvalHistory.createdAt));

  const byApproval = new Map<string, ApprovalHistoryEntry[]>();
  for (const h of hist) {
    const list = byApproval.get(h.approvalId);
    if (list) list.push(h);
    else byApproval.set(h.approvalId, [h]);
  }

  return rows.map((a) => ({ approval: a, history: byApproval.get(a.id) ?? [] }));
}

/** Overall approval progress summary folded from the per-site rows. */
export function foldApprovalProgress(sites: SiteApprovalProgress[]) {
  let total = 0;
  let completed = 0;
  let overdue = 0;
  for (const s of sites) {
    total += s.total;
    completed += s.completed;
    overdue += s.overdue;
  }
  return {
    total,
    completed,
    inProgress: total - completed,
    overdue,
    completionPct: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
  };
}
