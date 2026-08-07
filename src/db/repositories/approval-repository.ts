import { and, asc, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalBySite,
  approvalHistory,
  approvalOverdueBySite,
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

export type ApprovalAction = "submit" | "approve" | "reject" | "return" | "reassign";
export type ApprovalStatusValue = Approval["status"];

export type ApprovalTransitionInput = {
  approvalId: string;
  toStage: string;
  action: ApprovalAction;
  actor: string;
  note?: string;
  assignedTo?: string;
  /** Optional explicit status; otherwise derived from the action. */
  status?: ApprovalStatusValue;
};

export type ApprovalTransitionResult = {
  approval: Approval;
  entry: ApprovalHistoryEntry;
};

/** Derive the workflow status from the action when no explicit status is given. */
function statusForAction(action: ApprovalAction): ApprovalStatusValue {
  switch (action) {
    case "reject":
      return "rejected";
    case "return":
      return "returned";
    default:
      return "in_progress";
  }
}

/**
 * Record an approval transition atomically: advance the subject to `toStage`,
 * update its status/assignee, and append an immutable history entry capturing
 * who did what. Wrapped in a transaction so the stage change and its audit row
 * are always consistent. The caller is responsible for authorization; tenancy is
 * copied from the existing approval onto the history row.
 */
export async function recordApprovalTransition(
  input: ApprovalTransitionInput,
): Promise<ApprovalTransitionResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(approvals)
      .where(eq(approvals.id, input.approvalId))
      .limit(1);
    if (!current) throw new Error(`approval ${input.approvalId} not found`);

    const fromStage = current.currentStage;
    const status = input.status ?? statusForAction(input.action);

    const [updated] = await tx
      .update(approvals)
      .set({
        currentStage: input.toStage,
        status,
        assignedTo: input.assignedTo ?? current.assignedTo,
        updatedAt: new Date(),
      })
      .where(eq(approvals.id, input.approvalId))
      .returning();

    const [entry] = await tx
      .insert(approvalHistory)
      .values({
        approvalId: current.id,
        projectId: current.projectId,
        locationId: current.locationId,
        fromStage,
        toStage: input.toStage,
        action: input.action,
        actor: input.actor,
        note: input.note,
      })
      .returning();

    return { approval: updated, entry };
  });
}

/** Fetch a single approval with its chronological history, or null. */
export async function getApprovalWithHistory(
  id: string,
): Promise<{ approval: Approval; history: ApprovalHistoryEntry[] } | null> {
  const [approval] = await db.select().from(approvals).where(eq(approvals.id, id)).limit(1);
  if (!approval) return null;
  const history = await db
    .select()
    .from(approvalHistory)
    .where(eq(approvalHistory.approvalId, id))
    .orderBy(asc(approvalHistory.createdAt));
  return { approval, history };
}

export type ApprovalActivityInput = {
  approvalId: string;
  actor: string;
  note?: string;
  /** Optional reassignment of the current PIC. */
  assignedTo?: string;
};

/**
 * Append an activity entry to an approval without advancing its stage — used for
 * comments and reassignments. Records a history row at the current stage (action
 * "reassign") and, when `assignedTo` is provided, updates the PIC. Returns the
 * approval and the new history entry, or null when the approval does not exist.
 */
export async function recordApprovalActivity(
  input: ApprovalActivityInput,
): Promise<ApprovalTransitionResult | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(approvals)
      .where(eq(approvals.id, input.approvalId))
      .limit(1);
    if (!current) return null;

    let approval = current;
    if (input.assignedTo) {
      const [updated] = await tx
        .update(approvals)
        .set({ assignedTo: input.assignedTo, updatedAt: new Date() })
        .where(eq(approvals.id, input.approvalId))
        .returning();
      approval = updated;
    }

    const [entry] = await tx
      .insert(approvalHistory)
      .values({
        approvalId: current.id,
        projectId: current.projectId,
        locationId: current.locationId,
        fromStage: current.currentStage,
        toStage: current.currentStage,
        action: "reassign",
        actor: input.actor,
        note: input.note,
      })
      .returning();

    return { approval, entry };
  });
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

export type ApprovalRollupRow = {
  projectId: string;
  locationId: string;
  subjectType: string;
  currentStage: string;
  status: string;
  count: number;
};

/**
 * Per-site approval rollup (count by subject type, stage, and status) read from
 * the approval_by_site view. Tenant-scoped: a tenant query requires a projectId.
 */
export async function listApprovalRollup(filter: ApprovalFilter): Promise<ApprovalRollupRow[]> {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped approval queries");
    conds.push(eq(approvalBySite.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(approvalBySite.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(approvalBySite.locationId, filter.locationId));
  if (filter.subjectType) conds.push(eq(approvalBySite.subjectType, filter.subjectType));

  const rows = await db
    .select()
    .from(approvalBySite)
    .where(conds.length ? and(...conds) : undefined);
  return rows.map((r) => ({
    projectId: r.projectId,
    locationId: r.locationId,
    subjectType: r.subjectType,
    currentStage: r.currentStage,
    status: r.status,
    count: Number(r.count),
  }));
}

export type ApprovalOverdueRow = {
  projectId: string;
  locationId: string;
  inProgress: number;
  overdue: number;
};

/**
 * Per-site overdue-approval counts read from the approval_overdue_by_site view.
 * Tenant-scoped: a tenant query requires a projectId.
 */
export async function listApprovalOverdueBySite(filter: ApprovalFilter): Promise<ApprovalOverdueRow[]> {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) throw new Error("projectId is required for tenant-scoped approval queries");
    conds.push(eq(approvalOverdueBySite.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(approvalOverdueBySite.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(approvalOverdueBySite.locationId, filter.locationId));

  const rows = await db
    .select()
    .from(approvalOverdueBySite)
    .where(conds.length ? and(...conds) : undefined);
  return rows.map((r) => ({
    projectId: r.projectId,
    locationId: r.locationId,
    inProgress: Number(r.inProgress),
    overdue: Number(r.overdue),
  }));
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
