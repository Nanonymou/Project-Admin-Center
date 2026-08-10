import { listMasterTimeframes } from "@/db/repositories/master-timeframe-repository";
import { getApprovalTimeframes, type ApprovalTimeframe } from "@/lib/mock/approval-timeframe-config";

/**
 * Resolve the effective approval timeframes for a project + subject by applying
 * the Master Timeframe overrides (the master_timeframes table) on top of the
 * config-driven defaults. Active master rows win per stage (their SLA and order);
 * stages without a master row keep the config SLA; stages defined only in the
 * master are appended. Falls back entirely to the config when the DB is
 * unavailable or has no rows, so timeline computation always has a flow to work
 * from. No project-named branches — everything is keyed by project code.
 */
export async function resolveTimeframes(
  projectCode: string,
  subjectType: "invoice" | "daily_closing" = "invoice",
): Promise<ApprovalTimeframe[]> {
  const config = getApprovalTimeframes(projectCode, subjectType);
  try {
    const master = await listMasterTimeframes({ projectCode, subjectType, activeOnly: true });
    if (master.length === 0) return config;
    const byStage = new Map<string, ApprovalTimeframe>();
    for (const f of config) byStage.set(f.stage, { ...f });
    for (const m of master) {
      byStage.set(m.stage, { stage: m.stage, slaDays: m.slaDays, order: m.orderIndex });
    }
    return Array.from(byStage.values()).sort((a, b) => a.order - b.order);
  } catch {
    return config;
  }
}

/**
 * Resolve the SLA (in days) for a single stage from the effective timeframes,
 * or null when the stage is not part of the flow.
 */
export async function resolveStageSla(
  projectCode: string,
  stage: string,
  subjectType: "invoice" | "daily_closing" = "invoice",
): Promise<{ slaDays: number; order: number } | null> {
  const flow = await resolveTimeframes(projectCode, subjectType);
  const found = flow.find((f) => f.stage === stage);
  return found ? { slaDays: found.slaDays, order: found.order } : null;
}
