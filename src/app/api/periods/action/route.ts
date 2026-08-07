import { NextResponse, type NextRequest } from "next/server";
import {
  setPeriodStatus,
  type PeriodActionValue,
  type PeriodStatusValue,
} from "@/db/repositories/period-repository";
import { applyLockToTransactions } from "@/db/repositories/lock-period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/** Map a requested action to the resulting period status + history action. */
const ACTION_MAP: Record<string, { status: PeriodStatusValue; action: PeriodActionValue }> = {
  open: { status: "open", action: "open" },
  start_closing: { status: "closing", action: "start_closing" },
  close: { status: "closed", action: "close" },
  lock: { status: "locked", action: "lock" },
  unlock: { status: "open", action: "unlock" },
  reopen: { status: "open", action: "reopen" },
};

/**
 * POST /api/periods/action
 * Body: { projectId, locationId, periodLabel, action, periodType?, periodStart?,
 *         periodEnd?, note? }
 *
 * Runs a period lifecycle action (open | start_closing | close | lock | unlock |
 * reopen), records history, and cascades lock/unlock to the daily transactions in
 * the period window. Restricted to configure-capable personas within their scope.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json(
      { error: "Hanya Leader/Super Admin yang dapat mengelola periode." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const periodLabel = typeof body.periodLabel === "string" ? body.periodLabel : "";
  const actionKey = typeof body.action === "string" ? body.action : "";
  const mapped = ACTION_MAP[actionKey];
  if (!projectId || !locationId || !periodLabel || !mapped) {
    return NextResponse.json(
      {
        error:
          "projectId, locationId, periodLabel, dan action (open|start_closing|close|lock|unlock|reopen) wajib diisi.",
      },
      { status: 400 },
    );
  }

  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const periodStart = typeof body.periodStart === "string" ? body.periodStart : undefined;
  const periodEnd = typeof body.periodEnd === "string" ? body.periodEnd : undefined;
  const periodType = typeof body.periodType === "string" ? body.periodType : undefined;
  const note = typeof body.note === "string" ? body.note : undefined;

  try {
    const period = await setPeriodStatus({
      projectId,
      locationId,
      periodLabel,
      periodType,
      periodStart,
      periodEnd,
      status: mapped.status,
      action: mapped.action,
      actor: persona.name,
      note,
    });

    // Cascade lock/unlock to the transactions in the window.
    let affected = 0;
    if (actionKey === "lock" || actionKey === "unlock") {
      affected = await applyLockToTransactions({
        projectId,
        locationId,
        from: periodStart,
        to: periodEnd,
        locked: actionKey === "lock",
      });
    }

    revalidateKpi();
    return NextResponse.json({ source: "db", period, affectedTransactions: affected });
  } catch (err) {
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: `Aksi periode "${actionKey}" dicatat secara simulasi (database tidak tersedia).`,
      detail: err instanceof Error ? err.message : String(err),
      period: { projectId, locationId, periodLabel, status: mapped.status },
    });
  }
}
