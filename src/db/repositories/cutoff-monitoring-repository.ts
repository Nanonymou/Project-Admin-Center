import { and, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cutoffMonitoring, type CutoffMonitoring } from "@/db/schema";

export type CutoffFilter = {
  /** Required for tenant scope; omit only for cross-site (executive) views. */
  projectId?: string;
  locationId?: string;
  status?: string;
  /** "tenant" enforces a project filter; "executive" allows cross-project. */
  scope?: "tenant" | "executive";
};

function buildWhere(filter: CutoffFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.scope !== "executive") {
    if (!filter.projectId) {
      throw new Error("projectId is required for tenant-scoped cut-off queries");
    }
    conds.push(eq(cutoffMonitoring.projectId, filter.projectId));
  } else if (filter.projectId) {
    conds.push(eq(cutoffMonitoring.projectId, filter.projectId));
  }
  if (filter.locationId) conds.push(eq(cutoffMonitoring.locationId, filter.locationId));
  if (filter.status) conds.push(eq(cutoffMonitoring.status, filter.status as CutoffMonitoring["status"]));
  return conds.length ? and(...conds) : undefined;
}

/**
 * List cut-off monitoring rows for the filtered scope. Repository Pattern: all DB
 * access to the cutoff_monitoring table flows through this module; multi-tenancy
 * is enforced in `buildWhere`.
 */
export async function listCutoffMonitoring(filter: CutoffFilter): Promise<CutoffMonitoring[]> {
  const where = buildWhere(filter);
  return db.select().from(cutoffMonitoring).where(where);
}

export type CutoffStats = {
  siteCount: number;
  byStatus: Record<string, number>;
  byDelivery: Record<string, number>;
  avgSubmittedPct: number;
  criticalSites: number;
  pendingInvoices: number;
};

/** Fold monitoring rows into leader-dashboard statistics. */
export function foldCutoffStats(rows: { status: string; delivery: string; submittedPct: number; pendingInvoices: number }[]): CutoffStats {
  const byStatus: Record<string, number> = {};
  const byDelivery: Record<string, number> = {};
  let submittedSum = 0;
  let pendingInvoices = 0;
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byDelivery[r.delivery] = (byDelivery[r.delivery] ?? 0) + 1;
    submittedSum += r.submittedPct;
    pendingInvoices += r.pendingInvoices;
  }
  return {
    siteCount: rows.length,
    byStatus,
    byDelivery,
    avgSubmittedPct: rows.length ? Math.round((submittedSum / rows.length) * 100) / 100 : 0,
    criticalSites: byStatus.critical ?? 0,
    pendingInvoices,
  };
}
