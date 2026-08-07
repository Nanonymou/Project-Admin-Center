import {
  aggregateApprovalSlaBySite,
  type ApprovalFilter,
  type SiteSlaBuckets,
} from "@/db/repositories/approval-repository";
import { listSlaTargets } from "@/db/repositories/sla-target-repository";
import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";

export type SubjectType = "invoice" | "daily_closing";
const SUBJECT_TYPES: SubjectType[] = ["invoice", "daily_closing"];

/** Resolved SLA target for one project + subject type. */
export type ResolvedSlaTarget = {
  targetDays: number;
  atRiskPct: number;
  breachGraceDays: number;
  /** Days before the due date at which an approval is flagged at-risk. */
  atRiskWindowDays: number;
  source: "db" | "config";
};

/** Default SLA target from config: the sum of the flow's per-stage SLA days. */
function configTarget(projectCode: string, subjectType: SubjectType): ResolvedSlaTarget {
  const targetDays = getApprovalTimeframes(projectCode, subjectType).reduce(
    (sum, tf) => sum + (tf.slaDays || 0),
    0,
  );
  const atRiskPct = 80;
  return {
    targetDays,
    atRiskPct,
    breachGraceDays: 0,
    atRiskWindowDays: Math.max(1, Math.ceil((targetDays * (100 - atRiskPct)) / 100)),
    source: "config",
  };
}

/**
 * Resolve the SLA target for a project + subject type, preferring an active
 * `sla_targets` row and falling back to the config-derived default. Reading the
 * table once per call keeps the DB access inside the repository layer.
 */
export async function resolveSlaTarget(
  projectCode: string,
  subjectType: SubjectType,
): Promise<ResolvedSlaTarget> {
  try {
    const rows = await listSlaTargets({ projectCode, subjectType, activeOnly: true });
    const row = rows[0];
    if (!row) return configTarget(projectCode, subjectType);
    const atRiskWindowDays = Math.max(
      1,
      Math.ceil((row.targetDays * (100 - row.atRiskPct)) / 100),
    );
    return {
      targetDays: row.targetDays,
      atRiskPct: row.atRiskPct,
      breachGraceDays: row.breachGraceDays,
      atRiskWindowDays,
      source: "db",
    };
  } catch {
    return configTarget(projectCode, subjectType);
  }
}

export type SiteSlaRow = {
  projectId: string;
  locationId: string;
  total: number;
  completed: number;
  inProgress: number;
  onTime: number;
  atRisk: number;
  breached: number;
  /** % of open approvals that are on-time (0–100, two decimals). */
  compliancePct: number;
  /** Worst status among the site's open approvals. */
  status: "on_time" | "at_risk" | "breached" | "clear";
};

function foldSite(a: SiteSlaBuckets, b: SiteSlaBuckets): SiteSlaBuckets {
  return {
    ...a,
    total: a.total + b.total,
    completed: a.completed + b.completed,
    inProgress: a.inProgress + b.inProgress,
    onTime: a.onTime + b.onTime,
    atRisk: a.atRisk + b.atRisk,
    breached: a.breached + b.breached,
  };
}

function classify(open: number, atRisk: number, breached: number): SiteSlaRow["status"] {
  if (breached > 0) return "breached";
  if (atRisk > 0) return "at_risk";
  if (open > 0) return "on_time";
  return "clear";
}

/**
 * Compute per-site SLA approval metrics across both subject types. For each
 * subject type the resolved SLA window is applied, then the per-site buckets are
 * merged so a site's row reflects all of its in-flight approvals. Requires a
 * project-scoped filter unless the caller passes `scope: "executive"`.
 */
export async function computeSlaBySite(filter: ApprovalFilter): Promise<SiteSlaRow[]> {
  const merged = new Map<string, SiteSlaBuckets>();

  for (const subjectType of SUBJECT_TYPES) {
    // For tenant scope we need a concrete project to resolve targets; for
    // executive scope resolve per project as sites come back.
    const target =
      filter.projectId != null
        ? await resolveSlaTarget(filter.projectId, subjectType)
        : configTarget("__default__", subjectType);

    const buckets = await aggregateApprovalSlaBySite(
      { ...filter, subjectType },
      { atRiskWindowDays: target.atRiskWindowDays, breachGraceDays: target.breachGraceDays },
    );

    for (const b of buckets) {
      const key = `${b.projectId}::${b.locationId}`;
      const prev = merged.get(key);
      merged.set(key, prev ? foldSite(prev, b) : b);
    }
  }

  return Array.from(merged.values())
    .map((b) => {
      const open = b.inProgress;
      const compliancePct = open > 0 ? Math.round((b.onTime / open) * 10000) / 100 : 100;
      return {
        projectId: b.projectId,
        locationId: b.locationId,
        total: b.total,
        completed: b.completed,
        inProgress: b.inProgress,
        onTime: b.onTime,
        atRisk: b.atRisk,
        breached: b.breached,
        compliancePct,
        status: classify(open, b.atRisk, b.breached),
      };
    })
    .sort((a, b) => b.breached - a.breached || b.atRisk - a.atRisk);
}

/** Fold per-site SLA rows into an overall summary. */
export function foldSlaSummary(sites: SiteSlaRow[]) {
  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let onTime = 0;
  let atRisk = 0;
  let breached = 0;
  for (const s of sites) {
    total += s.total;
    completed += s.completed;
    inProgress += s.inProgress;
    onTime += s.onTime;
    atRisk += s.atRisk;
    breached += s.breached;
  }
  return {
    sites: sites.length,
    total,
    completed,
    inProgress,
    onTime,
    atRisk,
    breached,
    compliancePct: inProgress > 0 ? Math.round((onTime / inProgress) * 10000) / 100 : 100,
  };
}
