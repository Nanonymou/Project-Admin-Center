import { NextResponse, type NextRequest } from "next/server";
import {
  recordApprovalTransition,
  type ApprovalAction,
  type ApprovalStatusValue,
  type ApprovalTransitionInput,
} from "@/db/repositories/approval-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateApprovals } from "@/lib/server/approval-cache";
import { revalidateKpi } from "@/lib/server/kpi-cache";

export const dynamic = "force-dynamic";

const ACTIONS: ApprovalAction[] = ["submit", "approve", "reject", "return", "reassign"];
const STATUSES: ApprovalStatusValue[] = [
  "in_progress",
  "approved",
  "rejected",
  "returned",
  "completed",
];

/**
 * POST /api/approvals/transition
 * Body: { approvalId, projectId, locationId, toStage, action, note?, assignedTo?, status? }
 *
 * Advances an approval to the next stage and appends an audit entry, then
 * revalidates the approval (and KPI) caches so every reader sees the change in
 * real time. Requires an authenticated, non-viewer persona whose scope covers
 * the subject's project/location.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canApprove) {
    return NextResponse.json({ error: "Persona ini tidak memiliki hak approval." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const approvalId = typeof body.approvalId === "string" ? body.approvalId : "";
  const toStage = typeof body.toStage === "string" ? body.toStage : "";
  const action = body.action as ApprovalAction;
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  const locationId = typeof body.locationId === "string" ? body.locationId : undefined;

  if (!approvalId || !toStage || !ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "approvalId, toStage, dan action (submit|approve|reject|return|reassign) wajib diisi." },
      { status: 400 },
    );
  }
  const status = STATUSES.includes(body.status as ApprovalStatusValue)
    ? (body.status as ApprovalStatusValue)
    : undefined;

  // Authorize against the subject's scope (tenant-scoped: a project is required).
  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  const input: ApprovalTransitionInput = {
    approvalId,
    toStage,
    action,
    actor: persona.name,
    note: typeof body.note === "string" ? body.note : undefined,
    assignedTo: typeof body.assignedTo === "string" ? body.assignedTo : undefined,
    status,
  };

  try {
    const result = await recordApprovalTransition(input);
    // Data changed → refresh approval views (and KPI, since Payment settles).
    revalidateApprovals();
    revalidateKpi();
    return NextResponse.json({ source: "db", ...result });
  } catch (err) {
    // No live database: still refresh cached (mock) readers and echo the intent.
    revalidateApprovals();
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Transisi dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      transition: { ...input, projectId, locationId },
    });
  }
}
