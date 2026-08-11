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

export type WorkflowStage = {
  stage: string;
  order: number;
  slaDays: number;
  role: string | null;
  stageType: string | null;
  requiresDocument: boolean;
  source: "master" | "config";
};

/** Default responsible role (PIC) for a stage when the master doesn't set one. */
function defaultRole(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("site")) return "Site Admin";
  if (s.includes("leader")) return "Leader Admin";
  if (s.includes("finance")) return "Finance";
  if (s.includes("client")) return "Site Admin";
  if (s.includes("payment")) return "Client";
  return "Site Admin";
}

/** Default stage nature when the master doesn't set one. */
function defaultStageType(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("approval") || s.includes("leader")) return "approval";
  if (s.includes("kirim") || s.includes("client")) return "delivery";
  if (s.includes("payment")) return "payment";
  return "verification";
}

/**
 * Resolve the complete default approval workflow for a project + subject: the
 * ordered stages with SLA, responsible role, stage type, and document
 * requirement. Master Timeframe rows win per stage (carrying role/type/doc
 * flags); config supplies stages/SLA where the master is silent, with sensible
 * role/type defaults. Powers the Workflow Default Approval page. Falls back to
 * the config-only workflow when the DB is unavailable.
 */
export async function resolveWorkflow(
  projectCode: string,
  subjectType: "invoice" | "daily_closing" = "invoice",
): Promise<WorkflowStage[]> {
  const config = getApprovalTimeframes(projectCode, subjectType);
  const stages = new Map<string, WorkflowStage>();
  for (const f of config) {
    stages.set(f.stage, {
      stage: f.stage,
      order: f.order,
      slaDays: f.slaDays,
      role: defaultRole(f.stage),
      stageType: defaultStageType(f.stage),
      requiresDocument: false,
      source: "config",
    });
  }
  try {
    const master = await listMasterTimeframes({ projectCode, subjectType, activeOnly: true });
    for (const m of master) {
      stages.set(m.stage, {
        stage: m.stage,
        order: m.orderIndex,
        slaDays: m.slaDays,
        role: m.role ?? defaultRole(m.stage),
        stageType: m.stageType ?? defaultStageType(m.stage),
        requiresDocument: m.requiresDocument,
        source: "master",
      });
    }
  } catch {
    /* DB unavailable — config-only workflow is returned */
  }
  return Array.from(stages.values()).sort((a, b) => a.order - b.order);
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
