import { NextResponse, type NextRequest } from "next/server";
import {
  setClosingStatus,
  type ClosingActionValue,
  type ClosingStatusValue,
} from "@/db/repositories/daily-closing-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation, type Persona } from "@/lib/personas";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Per-action target status and the capability required. Submit is a site-level
 * action (any non-viewer with access); approve/reject need approval rights; lock
 * and reopen need configure rights (Leader/Super Admin).
 */
const TRANSITIONS: Record<
  string,
  { status: ClosingStatusValue; action: ClosingActionValue; allowed: (p: Persona) => boolean }
> = {
  submit: { status: "submitted", action: "submit", allowed: (p) => p.role !== "viewer" },
  approve: { status: "approved", action: "approve", allowed: (p) => p.capabilities.canApprove },
  reject: { status: "open", action: "reject", allowed: (p) => p.capabilities.canApprove },
  lock: { status: "locked", action: "lock", allowed: (p) => p.capabilities.canConfigure },
  reopen: { status: "open", action: "reopen", allowed: (p) => p.capabilities.canConfigure },
};

/**
 * POST /api/daily-closing/transition
 * Body: { projectId, locationId, closingDate, action: submit|approve|reject|lock|reopen, note? }
 *
 * Transitions a day's closing status with a per-action role check, records
 * history, and revalidates the KPI cache. The persona must have access to the
 * target site.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const closingDate = typeof body.closingDate === "string" ? body.closingDate : "";
  const actionKey = typeof body.action === "string" ? body.action : "";
  const transition = TRANSITIONS[actionKey];
  if (!projectId || !locationId || !DATE_RE.test(closingDate) || !transition) {
    return NextResponse.json(
      {
        error:
          "projectId, locationId, closingDate (YYYY-MM-DD), dan action (submit|approve|reject|lock|reopen) wajib diisi.",
      },
      { status: 400 },
    );
  }

  if (!transition.allowed(persona)) {
    return NextResponse.json(
      { error: `Peran ${persona.roleLabel} tidak berhak melakukan aksi "${actionKey}".` },
      { status: 403 },
    );
  }

  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const note = typeof body.note === "string" ? body.note : undefined;

  try {
    const closing = await setClosingStatus({
      projectId,
      locationId,
      closingDate,
      status: transition.status,
      action: transition.action,
      actor: persona.name,
      note,
    });
    revalidateKpi();
    return NextResponse.json({ source: "db", closing });
  } catch (err) {
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: `Transisi closing "${actionKey}" dicatat secara simulasi (database tidak tersedia).`,
      detail: err instanceof Error ? err.message : String(err),
      closing: { projectId, locationId, closingDate, status: transition.status },
    });
  }
}
